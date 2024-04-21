import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatIconButtonSizesModule } from 'mat-icon-button-sizes';
import { EditableLabelComponent } from '../editable-label/editable-label.component';
import { NgIf } from '@angular/common';
import { ChecklistItem, ChecklistItem_Type } from '../../../../../gen/ts/checklist';

@Component({
  selector: 'checklist-item',
  standalone: true,
  imports: [
    CdkDragHandle,
    EditableLabelComponent,
    MatButtonModule,
    MatIconButtonSizesModule,
    MatIconModule,
    NgIf,
  ],
  templateUrl: './item.component.html',
  styleUrl: './item.component.scss'
})
export class ChecklistItemComponent {
  @Input() item!: ChecklistItem;
  @Output() itemChanged = new EventEmitter<ChecklistItem>();
  readonly ChecklistItem_Type = ChecklistItem_Type;

  onIndent(item: ChecklistItem, delta: number) {
    item.indent += delta;
    this.onItemUpdated(item);
  }

  onItemUpdated(item: ChecklistItem) {
    this.itemChanged.emit(this.item);
  }
}
