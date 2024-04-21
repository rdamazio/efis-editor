import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { NgIf } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatIconButtonSizesModule } from 'mat-icon-button-sizes';
import { Checklist, ChecklistItem, ChecklistItem_Type } from '../../../../gen/ts/checklist';
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

  onDrop(event: CdkDragDrop<ChecklistItem[]>): void {
    moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    this.onItemUpdated();
  }

  onItemUpdated() {
    this.checklistChanged.emit(this._checklist);
  }

  onNewItem(type: ChecklistItem_Type) {
    let item : ChecklistItem = {
      prompt: 'New item',
      expectation: '',
      type: type,
      indent: 0,
    };
    if (type === ChecklistItem_Type.ITEM_PROMPT) {
      item.expectation = 'New expectation';
    }
    if (type == ChecklistItem_Type.ITEM_SPACE) {
      item.prompt = '';
    }
    this._checklist!.items.push(item);
    this.onItemUpdated();
  }
}
