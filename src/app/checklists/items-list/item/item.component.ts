import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { Component, ElementRef, input, output, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconButtonSizesModule } from 'mat-icon-button-sizes';
import { ChecklistItem, ChecklistItem_Type } from '../../../../../gen/ts/checklist';
import { EditableLabelComponent } from '../editable-label/editable-label.component';

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
})
export class ChecklistItemComponent {
  readonly item = input.required<ChecklistItem>();
  readonly itemChange = output<ChecklistItem>();
  readonly itemDeleted = output<boolean>();
  readonly itemFocused = output<boolean>();
  readonly itemBlurred = output<boolean>();
  readonly containerRef = viewChild.required<ElementRef<HTMLElement>>('container');
  readonly promptInput = viewChild.required<EditableLabelComponent>('promptInput');
  readonly expectationInput = viewChild.required<EditableLabelComponent>('expectationInput');
  private _shouldRestoreFocus = false;

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
    const item = this.item();
    if (item.type === ChecklistItem_Type.ITEM_SPACE) {
      return;
    }

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
    this.onItemUpdated();
    if (this.item().type === ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE) {
      this.expectationInput().save();
    }
    this._restoreFocus();
  }

  onSaveExpectation(expectation: string) {
    this.item().expectation = expectation;
    this.onItemUpdated();
    this.promptInput().save();
    this._restoreFocus();
  }

  onCancelEdit() {
    this.promptInput().cancel();
    if (this.item().type === ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE) {
      this.expectationInput().cancel();
    }
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

  focus() {
    this.containerRef().nativeElement.focus();
  }
}
