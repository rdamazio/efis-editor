import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { Component, ElementRef, Input, output, viewChild } from '@angular/core';
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
  // TODO: Skipped for migration because:
  //  This input is used in a control flow expression (e.g. `@if` or `*ngIf`)
  //  and migrating would break narrowing currently.
  @Input() item!: ChecklistItem;
  readonly itemChange = output<ChecklistItem>();
  readonly itemDeleted = output<boolean>();
  readonly itemFocused = output<boolean>();
  readonly itemBlurred = output<boolean>();
  readonly containerRef = viewChild.required<ElementRef<HTMLElement>>('container');
  readonly promptInput = viewChild.required<EditableLabelComponent>('promptInput');
  readonly expectationInput = viewChild.required<EditableLabelComponent>('expectationInput');
  private _shouldRestoreFocus = false;

  readonly ChecklistItem_Type = ChecklistItem_Type;

  onEdit(e?: Event) {
    this._shouldRestoreFocus = document.activeElement === this.containerRef().nativeElement;
    e?.stopPropagation();
    this.promptInput().edit();
    this.expectationInput().edit();
    this.promptInput().focus();
  }

  onIndent(item: ChecklistItem, delta: number) {
    item.indent += delta;
    this.onItemUpdated();
  }

  onCenterToggle(item: ChecklistItem) {
    item.indent = 0;
    item.centered = !item.centered;
    this.onItemUpdated();
  }

  onSavePrompt() {
    this.item.prompt = this.promptInput().value;
    this.onItemUpdated();
    this.expectationInput().save();
    this._restoreFocus();
  }

  onSaveExpectation() {
    this.item.expectation = this.expectationInput().value;
    this.onItemUpdated();
    this.promptInput().save();
    this._restoreFocus();
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
    this.itemChange.emit(this.item);
  }

  onDelete() {
    this.itemDeleted.emit(true);
  }

  focus() {
    this.containerRef().nativeElement.focus();
  }
}
