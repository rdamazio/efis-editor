import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { NgIf } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Checklist, ChecklistItem } from '../../../../gen/ts/checklist';
import { ChecklistItemComponent } from './item/item.component';

@Component({
  selector: 'checklist-items',
  templateUrl: './items-list.component.html',
  styleUrl: './items-list.component.scss',
  standalone: true,
  imports: [
    CdkDrag,
    CdkDragPlaceholder,
    CdkDropList,
    ChecklistItemComponent,
    NgIf,
  ]
})
export class ChecklistItemsComponent {
  @Output() checklistChanged = new EventEmitter<Checklist>();

  editing: boolean = false;
  _checklist?: Checklist;

  @Input()
  get checklist(): Checklist | undefined { return this._checklist; }
  set checklist(checklist: Checklist | undefined) {
    this._checklist = checklist;
  }

  onDrop(event: CdkDragDrop<ChecklistItem[]>): void {
    moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    this.onItemUpdated();
  }

  onItemUpdated() {
    this.checklistChanged.emit(this._checklist);
  }
}
