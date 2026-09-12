import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, ElementRef, model, output, viewChild } from '@angular/core';
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
})
export class ChecklistItemComponent {
  readonly item = model.required<ChecklistItem>();
  readonly itemDeleted = output<boolean>();
  readonly itemFocused = output<boolean>();
  readonly itemBlurred = output<boolean>();
  readonly containerRef = viewChild.required<ElementRef<HTMLElement>>('container');
  readonly promptInput = viewChild.required<EditableLabelComponent>('promptInput');
  readonly expectationInput = viewChild.required<EditableLabelComponent>('expectationInput');
  private _shouldRestoreFocus = false;
  private _newPrompt?: string;
  private _newExpectation?: string;

  readonly itemType = ChecklistItem_Type;

  onEdit(e?: Event) {
    e?.stopPropagation();
    if (this.item().type === ChecklistItem_Type.ITEM_SPACE) {
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
    const indent = this.item().indent + delta;
    if (indent >= 0 && indent <= 4) {
      this.item.update((i) => ({
        ...i,
        indent,
      }));
    }
  }

  onCenterToggle() {
    const itemType = this.item().type;
    if (itemType === ChecklistItem_Type.ITEM_SPACE || itemType === ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE) {
      return;
    }

    this.item.update((i) => ({
      ...i,
      indent: 0,
      centered: !i.centered,
    }));
  }

  onSavePrompt(prompt: string) {
    this._newPrompt = prompt;

    if (this.expectationInput().editing()) {
      // Let the expectation input propagate the change.
      this.expectationInput().save();
    } else {
      this._updateItem();
      this._restoreFocus();
    }
  }

  onSaveExpectation(expectation: string) {
    this._newExpectation = expectation;

    if (this.promptInput().editing()) {
      // Let the prompt input propagate the change.
      this.promptInput().save();
    } else {
      this._updateItem();
      this._restoreFocus();
    }
  }

  private _updateItem() {
    const prompt = this._newPrompt ?? this.item().prompt;
    const expectation = this._newExpectation ?? this.item().expectation;
    this._newPrompt = undefined;
    this._newExpectation = undefined;

    this.item.set({
      ...this.item(),
      prompt,
      expectation,
    });
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

  onDelete() {
    this.itemDeleted.emit(true);
  }

  onItemClick(event: MouseEvent) {
    event.stopPropagation();
    if (!this.promptInput().editing()) {
      this.focus();
    }
  }

  focus() {
    this.containerRef().nativeElement.focus();
  }

  blur() {
    this.containerRef().nativeElement.blur();
  }
}
