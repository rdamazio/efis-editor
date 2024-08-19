import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { NgIf } from '@angular/common';
import { Component, EventEmitter, Input, Output, QueryList, ViewChildren } from '@angular/core';
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
  @ViewChildren(ChecklistItemComponent) items!: QueryList<ChecklistItemComponent>;
  _checklist?: Checklist;
  _selectedIdx: number | null = null;

  @Output() checklistChange = new EventEmitter<Checklist>();
  @Input()
  get checklist(): Checklist | undefined {
    return this._checklist;
  }
  set checklist(checklist: Checklist | undefined) {
    this._checklist = checklist;
    this._selectedIdx = null;
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

  selectNextItem() {
    if (!this._checklist) {
      this._selectedIdx = null;
      return;
    }
    if (this._selectedIdx === null) {
      this._selectedIdx = 0;
    } else if (this._selectedIdx < this._checklist.items.length - 1) {
      this._selectedIdx++;
    }
    this._scrollToSelectedItem();
    this.onItemUpdated();
  }

  selectPreviousItem() {
    if (!this._checklist) {
      this._selectedIdx = null;
      return;
    }
    if (this._selectedIdx === null) {
      this._selectedIdx = this._checklist.items.length - 1;
    } else if (this._selectedIdx > 0) {
      this._selectedIdx--;
    }
    this._scrollToSelectedItem();
    this.onItemUpdated();
  }

  editCurrentItem() {
    this._selectedItemComponent()?.onEdit(undefined);
  }

  indentCurrentItem(delta: number) {
    const item = this._selectedItem();
    if (item && !item.centered) {
      const indent = item.indent + delta;
      // TODO: De-dupliate this logic with ChecklistItemsComponent
      if (indent >= 0 && indent <= 4) {
        item.indent = indent;
        this.onItemUpdated();
      }
    }
  }

  toggleCurrentItemCenter() {
    const item = this._selectedItem();
    if (item) {
      if (item.type !== ChecklistItem_Type.ITEM_SPACE && item.type !== ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE) {
        item.centered = !item.centered;
        item.indent = 0;
        this.onItemUpdated();
      }
    }
  }

  moveCurrentItemUp() {
    if (!this._selectedItem() || this._selectedIdx == 0) {
      return;
    }

    moveItemInArray(this._checklist!.items, this._selectedIdx! - 1, this._selectedIdx!);
    this._selectedIdx!--;
    this._scrollToSelectedItem();
    this.onItemUpdated();
  }

  moveCurrentItemDown() {
    if (!this._selectedItem() || this._selectedIdx === this.items.length - 1) {
      return;
    }

    moveItemInArray(this._checklist!.items, this._selectedIdx! + 1, this._selectedIdx!);
    this._selectedIdx!++;
    this._scrollToSelectedItem();
    this.onItemUpdated();
  }

  private _selectedItem(): ChecklistItem | undefined {
    if (!this._checklist || this._selectedIdx === null || this.items.length <= this._selectedIdx) {
      return undefined;
    }

    return this._checklist.items[this._selectedIdx];
  }

  private _selectedItemComponent(): ChecklistItemComponent | undefined {
    if (!this._checklist || this._selectedIdx === null || this.items.length <= this._selectedIdx) {
      return undefined;
    }

    return this.items.get(this._selectedIdx);
  }

  private _scrollToSelectedItem() {
    this._selectedItemComponent()?.elRef.nativeElement.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  }
}
