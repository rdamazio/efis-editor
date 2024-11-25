import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
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
  @Input() item!: ChecklistItem;
  @Output() itemChange = new EventEmitter<ChecklistItem>();
  @Output() itemDeleted = new EventEmitter<boolean>();
  @Output() itemFocused = new EventEmitter<boolean>();
  @Output() itemBlurred = new EventEmitter<boolean>();
  @ViewChild('container') containerRef?: ElementRef<HTMLElement>;
  @ViewChild('promptInput') promptInput?: EditableLabelComponent;
  @ViewChild('expectationInput') expectationInput?: EditableLabelComponent;
  private _shouldRestoreFocus = false;

  readonly ChecklistItem_Type = ChecklistItem_Type;

  onEdit(e?: Event) {
    this._shouldRestoreFocus = document.activeElement === this.containerRef!.nativeElement;
    e?.stopPropagation();
    this.promptInput!.edit();
    this.expectationInput!.edit();
    this.promptInput!.focus();
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
    this.item.prompt = this.promptInput!.value;
    this.onItemUpdated();
    this.expectationInput!.save();
    this._restoreFocus();
  }

  onSaveExpectation() {
    this.item.expectation = this.expectationInput!.value;
    this.onItemUpdated();
    this.promptInput!.save();
    this._restoreFocus();
  }

  onCancelEdit() {
    this.promptInput!.cancel();
    this.expectationInput!.cancel();
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
    this.containerRef!.nativeElement.focus();
  }
}
