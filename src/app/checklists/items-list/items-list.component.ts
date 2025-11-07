import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { afterNextRender, Component, Injector, input, model, output, viewChildren } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import scrollIntoView from 'scroll-into-view-if-needed';
import { Checklist, ChecklistItem, ChecklistItem_Type } from '../../../../gen/ts/checklist';
import { ChecklistItemComponent } from './item/item.component';

@UntilDestroy()
@Component({
  selector: 'checklist-items',
  imports: [CdkDrag, CdkDragPlaceholder, CdkDropList, ChecklistItemComponent, MatButtonModule, MatIconModule],
  templateUrl: './items-list.component.html',
  styleUrl: './items-list.component.scss',
})
export class ChecklistItemsComponent {
  // TODO: Customize snackbar to allow multiple undos.
  static readonly UNDO_LEVELS = 1;

  readonly itemTypes: { label: string; type: ChecklistItem_Type }[] = [
    { label: 'challenge/response', type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE },
    { label: 'challenge', type: ChecklistItem_Type.ITEM_CHALLENGE },
    { label: 'text', type: ChecklistItem_Type.ITEM_PLAINTEXT },
    { label: 'title', type: ChecklistItem_Type.ITEM_TITLE },
    { label: 'warning', type: ChecklistItem_Type.ITEM_WARNING },
    { label: 'caution', type: ChecklistItem_Type.ITEM_CAUTION },
    { label: 'note', type: ChecklistItem_Type.ITEM_NOTE },
    { label: 'blank row', type: ChecklistItem_Type.ITEM_SPACE },
  ];

  readonly checklist = model<Checklist | undefined>();
  // Angular's model uses reference equality to decide whether to emit, so we must use
  // an explicit output to notify about deeper changes in the object.
  readonly checklistChange = output<Checklist | undefined>();

  readonly groupDropListIds = input<string[]>([]);
  readonly items = viewChildren(ChecklistItemComponent);
  private _selectedIdx: number | null = null;
  // Whether to keep the intended selected item even if it loses focus.
  // This is used when DOM reconstruction is expected (e.g. reordering items).
  private _keepSelectedIdx = false;
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

  duplicateCurrentItem() {
    const currentItem = this._selectedItem();
    if (!currentItem || this._selectedIdx === null) {
      return;
    }

    const items = this.checklist()!.items;
    const newItem = ChecklistItem.clone(currentItem);
    const newIdx = this._selectedIdx + 1;

    items.splice(newIdx, 0, newItem);

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

  moveCurrentItemUp() {
    if (!this._selectedItem() || this._selectedIdx === 0) {
      return;
    }

    // We're moving the item that's currently focused, so Angular may detach and reattach it from the DOM,
    // which would cause it to lose focus before we can set the focus on the newly-moved item after rendering),
    // so force ourselved to keep it as the next selected item until the next focusing.
    this._keepSelectedIdx = true;
    moveItemInArray(this.checklist()!.items, this._selectedIdx! - 1, this._selectedIdx!);
    this._selectedIdx!--;
    this.onItemsUpdated();
  }

  moveCurrentItemDown() {
    if (!this._selectedItem() || this._selectedIdx === this.items().length - 1) {
      return;
    }

    // While detaching/reattaching the DOM doesn't currently happen when moving the item down, it technically
    // could, so we also do this here in case Angular changes their implementation.
    this._keepSelectedIdx = true;
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
    if (!this._keepSelectedIdx) {
      this._selectedIdx = idx;
    }
  }

  onItemBlurred() {
    if (!this._keepSelectedIdx) {
      this._selectedIdx = null;
    }
  }

  private _focusSelectedItem() {
    this._keepSelectedIdx = false;
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
    this._undoSnackbar
      .onAction()
      .pipe(untilDestroyed(this))
      .subscribe(() => {
        this._popUndoState();
      });
    this._undoSnackbar
      .afterDismissed()
      .pipe(untilDestroyed(this))
      .subscribe(() => {
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

    // The checklist object is referenced from the higher-level checklist file object,
    // so we must update it instead of replacing it.
    this.checklist.update((c?: Checklist) => {
      const undoTo = this._undoState.pop();
      if (c && undoTo) {
        c.title = undoTo.title;
        c.items = undoTo.items;
      }
      return c;
    });
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
