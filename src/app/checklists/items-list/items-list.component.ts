import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { NgIf } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Checklist, ChecklistItem, ChecklistItem_Type } from '../../../../gen/ts/checklist';
import { ChecklistItemComponent } from './item/item.component';

@Component({
  selector: 'checklist-items',
  templateUrl: './items-list.component.html',
  styleUrl: './items-list.component.scss',
  standalone: true,
  imports: [CdkDrag, CdkDragPlaceholder, CdkDropList, ChecklistItemComponent, MatButtonModule, MatIconModule, NgIf],
})
export class ChecklistItemsComponent {
  _checklist?: Checklist;
  readonly ITEM_TYPES: { label: string; type: ChecklistItem_Type }[] = [
    { label: 'challenge/response', type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE },
    { label: 'challenge', type: ChecklistItem_Type.ITEM_CHALLENGE },
    { label: 'text', type: ChecklistItem_Type.ITEM_PLAINTEXT },
    { label: 'title', type: ChecklistItem_Type.ITEM_TITLE },
    { label: 'warning', type: ChecklistItem_Type.ITEM_WARNING },
    { label: 'caution', type: ChecklistItem_Type.ITEM_CAUTION },
    { label: 'note', type: ChecklistItem_Type.ITEM_NOTE },
    { label: 'blank row', type: ChecklistItem_Type.ITEM_SPACE },
  ];

  @Output() checklistChange = new EventEmitter<Checklist>();
  @Input()
  get checklist(): Checklist | undefined {
    return this._checklist;
  }
  set checklist(checklist: Checklist | undefined) {
    this._checklist = checklist;
  }

  onDrop(event: CdkDragDrop<ChecklistItem[]>): void {
    moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    this.onItemUpdated();
  }

  onItemUpdated() {
    this.checklistChange.emit(this._checklist);
  }

  onItemDeleted(idx: number) {
    this._checklist!.items.splice(idx, 1);
    this.checklistChange.emit(this._checklist);
  }

  onNewItem(type: ChecklistItem_Type) {
    const item = ChecklistItem.create({
      prompt: 'New item',
      type: type,
    });
    if (type === ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE) {
      item.expectation = 'New expectation';
    }
    if (type === ChecklistItem_Type.ITEM_SPACE) {
      item.prompt = '';
    }
    this._checklist!.items.push(item);
    this.onItemUpdated();
  }
}
