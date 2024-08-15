import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { NgIf } from '@angular/common';
import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatIconButtonSizesModule } from 'mat-icon-button-sizes';
import { ChecklistItem, ChecklistItem_Type } from '../../../../../gen/ts/checklist';
import { EditableLabelComponent } from '../editable-label/editable-label.component';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'checklist-item',
  standalone: true,
  imports: [
    CdkDragHandle,
    EditableLabelComponent,
    MatButtonModule,
    MatIconButtonSizesModule,
    MatIconModule,
    MatTooltipModule,
    NgIf,
  ],
  templateUrl: './item.component.html',
  styleUrl: './item.component.scss',
})
export class ChecklistItemComponent {
  @Input() item!: ChecklistItem;
  @Output() itemChange = new EventEmitter<ChecklistItem>();
  @Output() itemDeleted = new EventEmitter<boolean>();
  @ViewChild('promptInput') promptInput?: EditableLabelComponent;
  @ViewChild('expectationInput') expectationInput?: EditableLabelComponent;

  readonly ChecklistItem_Type = ChecklistItem_Type;

  onEdit(e: Event) {
    e.stopPropagation();
    this.promptInput?.edit();
    this.expectationInput?.edit();
    this.promptInput?.focus();
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
  }

  onSaveExpectation() {
    this.item.expectation = this.expectationInput!.value;
    this.onItemUpdated();
    this.promptInput!.save();
  }

  onItemUpdated() {
    this.itemChange.emit(this.item);
  }

  onDelete() {
    this.itemDeleted.emit(true);
  }
}
