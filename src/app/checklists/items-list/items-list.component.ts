import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDragPlaceholder, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Checklist, ChecklistItem } from '../../../../gen/ts/checklist';

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
    MatIconModule,
  ]
})
export class ChecklistItemsComponent {
  _checklist?: Checklist;

  @Input()
  get checklist() : Checklist | undefined { return this._checklist; }
  set checklist(checklist: Checklist | undefined) {
    this._checklist = checklist;
  }

  onDrop(event: CdkDragDrop<ChecklistItem[]>): void {
    moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
  }
}
