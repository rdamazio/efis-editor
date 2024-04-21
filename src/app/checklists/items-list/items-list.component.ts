import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDragPlaceholder, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { NgIf } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule, MatLabel } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatIconButtonSizesModule } from 'mat-icon-button-sizes';
import { Checklist, ChecklistItem, ChecklistItem_Type } from '../../../../gen/ts/checklist';
import { EditableLabelComponent } from './editable-label/editable-label.component';

@Component({
  selector: 'checklist-items',
  templateUrl: './items-list.component.html',
  styleUrl: './items-list.component.scss',
  standalone: true,
  imports: [
    CdkDrag,
    CdkDragHandle,
    CdkDragPlaceholder,
    CdkDropList,
    EditableLabelComponent,
    MatButtonModule,
    MatIconButtonSizesModule,
    MatIconModule,
    NgIf,
  ]
})
export class ChecklistItemsComponent {
  @Output() checklistChanged = new EventEmitter<Checklist>();

  editing: boolean = false;
  _checklist?: Checklist;
  readonly ChecklistItem_Type = ChecklistItem_Type;

  @Input()
  get checklist(): Checklist | undefined { return this._checklist; }
  set checklist(checklist: Checklist | undefined) {
    this._checklist = checklist;
  }

  onIndent(item: ChecklistItem, delta: number) {
    item.indent += delta;
    this.checklistChanged.emit(this._checklist);
  }

  onDrop(event: CdkDragDrop<ChecklistItem[]>): void {
    moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
  }

  onItemUpdated() {
    this.checklistChanged.emit(this._checklist);
  }
}
