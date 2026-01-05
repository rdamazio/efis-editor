import { Component, computed, effect, ElementRef, Injector, input, model, output, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatIconButtonSizesModule } from 'mat-icon-button-sizes';

@Component({
  selector: 'search-box',
  imports: [FormsModule, MatButtonModule, MatIconModule, MatInputModule, MatIconButtonSizesModule],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss',
})
export class SearchComponent {
  readonly query = model.required<string>();
  readonly totalMatches = input.required<number>();
  readonly searchCancel = output();

  readonly queryInput = viewChild.required<ElementRef<HTMLInputElement>>('queryInput');

  // Zero-indexed match number.
  readonly currentMatch = model<number>();
  readonly currentMatchToDisplay = computed(() => {
    const current = this.currentMatch();
    if (current === undefined || current >= this.totalMatches()) {
      return 0;
    }
    return current + 1;
  });

  constructor(private readonly _injector: Injector) {
    effect(() => {
      // Keep the current match within the boundaries of the total matches.
      const current = this.currentMatch();
      const totalMatches = this.totalMatches();
      if (current === undefined) {
        return;
      }
      if (totalMatches === 0) {
        this.currentMatch.set(undefined);
      } else if (current > totalMatches - 1) {
        this.currentMatch.set(totalMatches - 1);
      } else if (current < 0) {
        this.currentMatch.set(0);
      }
    });
  }

  focus() {
    this.queryInput().nativeElement.focus();
  }

  next() {
    this.currentMatch.update((value) => {
      const totalMatches = this.totalMatches();
      if (totalMatches === 0) {
        return undefined;
      }
      if (value === undefined) {
        return 0;
      }
      if (value >= totalMatches - 1) {
        return value;
      }
      return value + 1;
    });
  }

  prev() {
    this.currentMatch.update((value) => {
      const totalMatches = this.totalMatches();
      if (totalMatches === 0) {
        return undefined;
      }
      if (value === undefined) {
        return totalMatches - 1;
      }
      if (value === 0) {
        return value;
      }
      return value - 1;
    });
  }
}
