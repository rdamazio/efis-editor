import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, ElementRef, input, output, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconButtonSizesModule } from 'mat-icon-button-sizes';
import { ChecklistItem, ChecklistItem_Type } from '../../../../../gen/ts/checklist';
import { EditableLabelComponent } from '../../../shared/editable-label/editable-label.component';

@Component({
  selector: 'checklist-item',
  imports: [
    CdkDragHandle,
    EditableLabelComponent,
    MatButtonModule,
    MatIconButtonSizesModule,
    MatIconModule,
    MatTooltipModule,
  ],
  templateUrl: './item.component.html',
  styleUrl: './item.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  host: {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    '(keydown)': 'onKeyDown($event)',
  },
})
export class ChecklistItemComponent {
  readonly item = input.required<ChecklistItem>();
  readonly checkMode = input(false);
  readonly checked = input(false);
  readonly itemChange = output<ChecklistItem>();
  readonly itemDeleted = output<boolean>();
  readonly itemFocused = output<boolean>();
  readonly itemBlurred = output<boolean>();
  readonly itemCheckedToggle = output();
  readonly containerRef = viewChild.required<ElementRef<HTMLElement>>('container');
  readonly promptInput = viewChild.required<EditableLabelComponent>('promptInput');
  readonly expectationInput = viewChild.required<EditableLabelComponent>('expectationInput');
  private _shouldRestoreFocus = false;

  readonly itemType = ChecklistItem_Type;

  isCheckable(): boolean {
    const t = this.item().type;
    return t === ChecklistItem_Type.ITEM_CHALLENGE || t === ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE;
  }

  onKeyDown(event: KeyboardEvent) {
    if (this.checkMode() && (event.key === ' ' || event.key === 'Enter')) {
      if (this.isCheckable()) {
        event.preventDefault();
        event.stopPropagation();
        this.itemCheckedToggle.emit();
      }
    }
  }

  onEdit(e?: Event) {
    e?.stopPropagation();
    if (this.checkMode() || this.item().type === ChecklistItem_Type.ITEM_SPACE) {
      return;
    }

    this._shouldRestoreFocus = document.activeElement === this.containerRef().nativeElement;
    this.promptInput().edit();
    if (this.item().type === ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE) {
      this.expectationInput().edit();
    }
    this.promptInput().focus();
  }

  onIndent(delta: number) {
    const item = this.item();
    const indent = item.indent + delta;
    if (indent >= 0 && indent <= 4) {
      item.indent = indent;
      this.onItemUpdated();
    }
  }

  onCenterToggle() {
    const item = this.item();
    if (item.type === ChecklistItem_Type.ITEM_SPACE || item.type === ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE) {
      return;
    }

    item.indent = 0;
    item.centered = !item.centered;
    this.onItemUpdated();
  }

  onSavePrompt(prompt: string) {
    this.item().prompt = prompt;
    if (this.expectationInput().editing()) {
      // Let the expectation input propagate the change.
      this.expectationInput().save();
    } else {
      this.onItemUpdated();
      this._restoreFocus();
    }
  }

  onSaveExpectation(expectation: string) {
    this.item().expectation = expectation;
    if (this.promptInput().editing()) {
      // Let the prompt input propagate the change.
      this.promptInput().save();
    } else {
      this.onItemUpdated();
      this._restoreFocus();
    }
  }

  onCancelEdit() {
    this.promptInput().cancel();
    this.expectationInput().cancel();
    this._restoreFocus();
  }

  private _restoreFocus() {
    if (this._shouldRestoreFocus) {
      this.focus();
    }
    this._shouldRestoreFocus = false;
  }

  onItemUpdated() {
    this.itemChange.emit(this.item());
  }

  onDelete() {
    this.itemDeleted.emit(true);
  }

  onCheckboxClick(event: MouseEvent) {
    event.stopPropagation();
    if (this.checkMode() && this.isCheckable()) {
      this.itemCheckedToggle.emit();
    }
  }

  onItemClick(event: MouseEvent) {
    event.stopPropagation();
    if (this.checkMode()) {
      if (this.isCheckable()) {
        this.itemCheckedToggle.emit();
      }
    } else {
      if (!this.promptInput().editing()) {
        this.focus();
      }
    }
  }

  focus() {
    this.containerRef().nativeElement.focus();
  }

  blur() {
    this.containerRef().nativeElement.blur();
  }
}
