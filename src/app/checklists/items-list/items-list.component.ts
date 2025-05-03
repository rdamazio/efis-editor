import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { afterNextRender, Component, Injector, input, model, output, viewChildren } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import scrollIntoView from 'scroll-into-view-if-needed';
import { Checklist, ChecklistItem, ChecklistItem_Type } from '../../../../gen/ts/checklist';
import { ChecklistItemComponent } from './item/item.component';

@Component({
  selector: 'checklist-items',
  templateUrl: './items-list.component.html',
  styleUrl: './items-list.component.scss',
  imports: [CdkDrag, CdkDragPlaceholder, CdkDropList, ChecklistItemComponent, MatButtonModule, MatIconModule],
})
export class ChecklistItemsComponent {
  // TODO: Customize snackbar to allow multiple undos.
  static readonly UNDO_LEVELS = 1;

  readonly itemTypes: { label: string; type: ChecklistItem_Type }[] = [
    { label: 'Challenge/response', type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE },
    { label: 'Challenge', type: ChecklistItem_Type.ITEM_CHALLENGE },
    { label: 'Text', type: ChecklistItem_Type.ITEM_PLAINTEXT },
    { label: 'Title', type: ChecklistItem_Type.ITEM_TITLE },
    { label: 'Warning', type: ChecklistItem_Type.ITEM_WARNING },
    { label: 'Caution', type: ChecklistItem_Type.ITEM_CAUTION },
    { label: 'Note', type: ChecklistItem_Type.ITEM_NOTE },
    { label: 'Blank row', type: ChecklistItem_Type.ITEM_SPACE },
  ];

  readonly checklist = model<Checklist | undefined>();
  // Angular's model uses reference equality to decide whether to emit, so we must use
  // an explicit output to notify about deeper changes in the object.
  readonly checklistChange = output<Checklist | undefined>();

  readonly groupDropListIds = input<string[]>([]);
  readonly items = viewChildren(ChecklistItemComponent);
  private _selectedIdx: number | null = null;
  private _undoState: Checklist[] = [];
  private _undoSnackbar?: MatSnackBarRef<TextOnlySnackBar>;

  constructor(
    private readonly _injector: Injector,
    private readonly _snackBar: MatSnackBar,
  ) {
    this.checklist.subscribe(() => {
      // When we open an entirely separate checklist, get rid of selection and undo history.
      this._selectedIdx = null;
      this._dismissUndoSnackbar();
      this._undoState = [];
    });
  }

  onDrop(event: CdkDragDrop<ChecklistItem[]>): void {
    moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    this.onItemsUpdated();
  }

  onItemsUpdated() {
    this.checklistChange.emit(this.checklist());
    afterNextRender(
      () => {
        this._focusSelectedItem();
      },
      { injector: this._injector },
    );
  }

  onItemDeleted(idx: number) {
    this._pushUndoState('Item deleted');

    const checklist = this.checklist();
    checklist!.items.splice(idx, 1);
    this.checklistChange.emit(checklist);
  }

  onNewItem(type: ChecklistItem_Type) {
    const item = ChecklistItem.create({ prompt: 'New item', type: type });
    if (type === ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE) {
      item.expectation = 'New expectation';
    }
    if (type === ChecklistItem_Type.ITEM_SPACE) {
      item.prompt = '';
    }
    const items = this.checklist()!.items;

    // Add after the selected item, or at the end if none selected.
    let newIdx: number;
    if (this._selectedIdx === null) {
      newIdx = items.length;
    } else {
      newIdx = this._selectedIdx + 1;
    }
    items.splice(newIdx, 0, item);

    this.onItemsUpdated();

    // Set focus to the newly added item.
    afterNextRender(
      () => {
        this._selectedIdx = newIdx;
        this._focusSelectedItem();
      },
      { injector: this._injector },
    );
  }

  selectNextItem() {
    const checklist = this.checklist();
    if (!checklist) {
      this._selectedIdx = null;
      return;
    }
    if (this._selectedIdx === null) {
      this._selectedIdx = 0;
    } else if (this._selectedIdx < checklist.items.length - 1) {
      this._selectedIdx++;
    }
    this.onItemsUpdated();
  }

  selectPreviousItem() {
    const checklist = this.checklist();
    if (!checklist) {
      this._selectedIdx = null;
      return;
    }
    if (this._selectedIdx === null) {
      this._selectedIdx = checklist.items.length - 1;
    } else if (this._selectedIdx > 0) {
      this._selectedIdx--;
    }
    this.onItemsUpdated();
  }

  editCurrentItem() {
    this._selectedItemComponent()?.onEdit(undefined);
  }

  deleteCurrentItem() {
    this._selectedItemComponent()?.onDelete();

    if (this._selectedIdx === this.checklist()!.items.length) {
      this.selectPreviousItem();
    } else {
      this.onItemsUpdated();
    }
  }

  indentCurrentItem(delta: number) {
    this._selectedItemComponent()?.onIndent(delta);
  }

  toggleCurrentItemCenter() {
    this._selectedItemComponent()?.onCenterToggle();
  }

  moveCurrentItemUp() {
    if (!this._selectedItem() || this._selectedIdx === 0) {
      return;
    }

    moveItemInArray(this.checklist()!.items, this._selectedIdx! - 1, this._selectedIdx!);
    this._selectedIdx!--;
    this.onItemsUpdated();

    // HACK: I don't really understand why it works IFF this is done both before and after render on move up (but not down).
    this._focusSelectedItem();
  }

  moveCurrentItemDown() {
    if (!this._selectedItem() || this._selectedIdx === this.items().length - 1) {
      return;
    }

    moveItemInArray(this.checklist()!.items, this._selectedIdx! + 1, this._selectedIdx!);
    this._selectedIdx!++;
    this.onItemsUpdated();
  }

  private _selectedItem(): ChecklistItem | undefined {
    const checklist = this.checklist();
    if (!checklist || this._selectedIdx === null || this.items().length <= this._selectedIdx) {
      return undefined;
    }

    return checklist.items[this._selectedIdx];
  }

  private _selectedItemComponent(): ChecklistItemComponent | undefined {
    if (!this.checklist() || this._selectedIdx === null || this.items().length <= this._selectedIdx) {
      return undefined;
    }

    return this.items().at(this._selectedIdx);
  }

  onItemFocused(idx: number) {
    this._selectedIdx = idx;
  }

  onItemBlurred() {
    this._selectedIdx = null;
  }

  private _focusSelectedItem() {
    const item = this._selectedItemComponent();
    const containerRef = item?.containerRef();
    if (item && containerRef) {
      item.focus();
      scrollIntoView(containerRef.nativeElement, {
        scrollMode: 'if-needed',
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }

  private _pushUndoState(txt: string) {
    // Save the full state for undoing, up to the max levels.
    if (this._undoState.length === ChecklistItemsComponent.UNDO_LEVELS) {
      this._undoState.splice(0, 1);
    }
    this._undoState.push(Checklist.clone(this.checklist()!));

    // Show snackbar with option to undo.
    this._undoSnackbar = this._snackBar.open(txt, 'Undo');
    this._undoSnackbar.onAction().subscribe(() => {
      this._popUndoState();
    });
    this._undoSnackbar.afterDismissed().subscribe(() => {
      this._undoSnackbar = undefined;
    });
  }

  private _dismissUndoSnackbar() {
    this._undoSnackbar?.dismiss();
  }

  private _popUndoState() {
    if (this._undoState.length === 0) {
      return;
    }

    this.checklist.set(this._undoState.pop());
    this.onItemsUpdated();
  }

  itemLabel(item: ChecklistItem): string {
    if (item.type === ChecklistItem_Type.ITEM_SPACE) {
      return 'Blank item';
    }
    return `Item: ${item.prompt}`;
  }

  // Opt-out of NG0956 warning regarding tracking by identity (non-static collection)
  protected readonly _trackChecklistItem = (item: ChecklistItem) => item;
}
