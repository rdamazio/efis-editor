import { CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';
import { AfterViewInit, Directive, EventEmitter, OnDestroy, computed, effect, input } from '@angular/core';
import { takeUntil } from 'rxjs';
import { ChecklistTreeNode } from './node/node';
import { ChecklistTreeNodeComponent } from './node/node.component';

@Directive({ selector: '[checklistDrag]', standalone: true })
export class ChecklistDragDirective extends CdkDrag<ChecklistTreeNode> implements AfterViewInit, OnDestroy {
  readonly allDropLists = input<readonly CdkDropList<ChecklistTreeNode>[]>();
  readonly checklistDragNode = input<ChecklistTreeNodeComponent>();

  private readonly _dropList = computed(() => this._findContainer());
  private readonly _destroyed2 = new EventEmitter<boolean>();
  private readonly _updateContainerEffect =
    // We have to dynamically detect drop lists because they're not bound at injection time,
    // due to the cdkDrag being outside of the cdkDropList on the template.
    effect(() => {
      const dropList = this._dropList();
      if (dropList) {
        setTimeout(() => {
          this._updateContainer(dropList);
        });
      }
    });

  override ngAfterViewInit() {
    // Also dynamically register drag handles that were passed in to us.
    // This must be done before the parent's ngAfterViewInit, which uses them.
    const handle = this.checklistDragNode()?.dragHandle();
    if (handle) {
      this._addHandle(handle);
    }

    super.ngAfterViewInit();
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._destroyed2.emit(true);
  }

  private _findContainer(): CdkDropList<ChecklistTreeNode> | undefined {
    const dropLists = this.allDropLists();
    if (!dropLists) return undefined;

    // Finds the CdkDropList that's actually been assigned as our parent after
    // view setup, since the association doesn't exist in the template.
    const containerEl = this.element.nativeElement.closest('.cdk-drop-list');
    for (const dropList of dropLists) {
      if (dropList.element.nativeElement === containerEl) {
        return dropList;
      }
    }

    return undefined;
  }

  private _updateContainer(dropList: CdkDropList<ChecklistTreeNode>) {
    // If dependency injection fails, it may actually be null despite the declaration.
    if (this.dropContainer as CdkDropList | null) {
      if (this.dropContainer === dropList) return;

      // Changed drop containers, remove from the old one.
      this.dropContainer.removeItem(this);
    }

    // This mimics what CdkDrag normally does at construction time.
    this.dropContainer = dropList;
    this._dragRef._withDropContainer(dropList._dropListRef);
    dropList.addItem(this);
    dropList._dropListRef.beforeStarted.pipe(takeUntil(this._destroyed2)).subscribe(() => {
      this._dragRef.scale = this.scale;
    });
  }
}
