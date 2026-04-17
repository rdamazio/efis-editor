import {
  AfterViewInit,
  computed,
  Directive,
  effect,
  ElementRef,
  Injector,
  input,
  Renderer2,
  SecurityContext,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

@Directive({
  selector: '[highlightTerms]',
})
export class HighlightTermsDirective implements AfterViewInit {
  readonly text = input<string>('');
  readonly highlightTerms = input.required<string[]>();
  readonly highlightClass = input.required<string>();

  private readonly _regex = computed(() => this._regexForTerms(this.highlightTerms()));

  constructor(
    private readonly _el: ElementRef,
    private readonly _renderer: Renderer2,
    private readonly _sanitizer: DomSanitizer,
    private readonly _injector: Injector,
  ) {}

  ngAfterViewInit() {
    effect(
      () => {
        this.highlight();
      },
      { injector: this._injector },
    );
  }

  private highlight() {
    const text = this.text();
    const className = this.highlightClass();
    const element = this._el.nativeElement as HTMLElement;

    const html = this._getHighlightedHtml(text, className);

    // Sanitize the result just in case
    const sanitized = this._sanitizer.sanitize(SecurityContext.HTML, html) || '';

    this._renderer.setProperty(element, 'innerHTML', sanitized);
  }

  private _regexForTerms(terms: string[]): RegExp | undefined {
    if (!terms.length) return undefined;

    // Escape terms for regex
    const escapedTerms = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(`(${escapedTerms.join('|')})`, 'gi');
  }

  private _getHighlightedHtml(text: string, className: string): string {
    const regex = this._regex();
    if (!regex) {
      return this._escapeHtml(text);
    }

    // Split text by regex to find matches and non-matches
    const parts = text.split(regex);

    let result = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const escapedPart = this._escapeHtml(part);
      if (i % 2 === 1) {
        // This is a match (even indices are non-matches, odd are matches)
        result += `<mark class="${className}">${escapedPart}</mark>`;
      } else {
        result += escapedPart;
      }
    }
    return result;
  }

  private _escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
