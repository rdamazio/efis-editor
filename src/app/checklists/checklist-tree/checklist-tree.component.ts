import {
  CdkDrag,
  CdkDragDrop,
  CdkDragEnter,
  CdkDragExit,
  CdkDropList,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import {
  afterNextRender,
  AfterViewInit,
  Component,
  ElementRef,
  Injector,
  model,
  OnInit,
  output,
  viewChild,
  viewChildren,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTree, MatTreeModule, MatTreeNestedDataSource } from '@angular/material/tree';
import { MatIconButtonSizesModule } from 'mat-icon-button-sizes';
import scrollIntoView from 'scroll-into-view-if-needed';
import {
  Checklist,
  ChecklistFile,
  ChecklistGroup,
  ChecklistGroup_Category,
  ChecklistItem,
} from '../../../../gen/ts/checklist';
import { TitleDialogComponent } from '../dialogs/title-dialog/title-dialog.component';
import { ChecklistDragDirective } from './drag.directive';
import { ChecklistTreeNode } from './node/node';
import { ChecklistTreeNodeComponent } from './node/node.component';

interface ChecklistPosition {
  groupIdx: number;
  checklistIdx: number;
}
type MovementDirection = 'up' | 'down';

@Component({
  selector: 'checklist-tree',
  imports: [
    CdkDropList,
    ChecklistDragDirective,
    ChecklistTreeNodeComponent,
    MatButtonModule,
    MatDialogModule,
    MatIconButtonSizesModule,
    MatIconModule,
    MatTreeModule,
  ],
  templateUrl: './checklist-tree.component.html',
  styleUrl: './checklist-tree.component.scss',
})
export class ChecklistTreeComponent implements OnInit, AfterViewInit {
  readonly file = model<ChecklistFile>();
  readonly fileModified = output<ChecklistFile>();
  readonly selectedChecklist = model<Checklist>();
  readonly selectedChecklistGroup = model<ChecklistGroup>();
  readonly groupDropListIds = model<string[]>([]);
  readonly tree = viewChild.required(MatTree);
  readonly allDropLists = viewChildren(CdkDropList<ChecklistTreeNode>);
  dataSource = new MatTreeNestedDataSource<ChecklistTreeNode>();

  dragging = false;

  constructor(
    private readonly _element: ElementRef<Element>,
    private readonly _dialog: MatDialog,
    private readonly _injector: Injector,
  ) {}

  ngOnInit() {
    this.file.subscribe(this._onFileChanged.bind(this));
    this.selectedChecklist.subscribe(this._scrollToSelectedChecklist.bind(this));
  }

  ngAfterViewInit() {
    this._onFileChanged();
    this._scrollToSelectedChecklist();
  }

  private _onFileChanged() {
    // When a new file is loaded, drop the current checklist/group selection.
    this._reloadFile(false);
    if (this.selectedChecklist() || this.selectedChecklistGroup()) {
      this._selectChecklist(undefined, undefined);
    }
  }

  private _reloadFile(modified: boolean) {
    let data: ChecklistTreeNode[] = [];
    const file = this.file();
    if (file) {
      data = file.groups.map(ChecklistTreeComponent._groupToNode);
      data.push({
        title: 'Add new checklist group',
        isAddNew: true,
      });
      this.groupDropListIds.set(file.groups.map((v: ChecklistGroup, idx: number) => `group_${idx}`));
    } else {
      this.groupDropListIds.set([]);
    }

    this.dataSource.data = data;
    this.tree().expandAll();

    if (modified && file) {
      this.fileModified.emit(file);
    }
  }

  private static _groupToNode(group: ChecklistGroup, groupIdx: number): ChecklistTreeNode {
    const node: ChecklistTreeNode = {
      title: group.title,
      group: group,
      groupIdx: groupIdx,
      children: group.checklists.map((checklist: Checklist, checklistIdx: number) => ({
        title: checklist.title,
        group: group,
        groupIdx: groupIdx,
        checklist: checklist,
        checklistIdx: checklistIdx,
        isAddNew: false,
      })),
      isAddNew: false,
    };
    node.children?.push({
      title: 'Add new checklist',
      group: group,
      isAddNew: true,
    });
    return node;
  }

  hasChild = (unusedNum: number, node: ChecklistTreeNode) => node.children && node.children.length > 0;
  childrenAccessor = (node: ChecklistTreeNode) => node.children ?? [];

  async onNodeSelect(node: ChecklistTreeNode) {
    let checklist: Checklist | undefined;
    let checklistGroup: ChecklistGroup | undefined;
    if (!node.isAddNew) {
      checklist = node.checklist;
      checklistGroup = node.group;
    } else {
      if (node.group) {
        // Adding new checklist to a group.
        checklist = Checklist.create();
        if (!(await this._fillTitle(checklist, 'checklist'))) {
          return;
        }
        checklistGroup = node.group;
        node.group.checklists.push(checklist);
      } else {
        // Adding new group to the file.
        checklistGroup = ChecklistGroup.create({
          category: ChecklistGroup_Category.normal,
        });
        if (!(await this._fillTitle(checklistGroup, 'checklist group'))) {
          return;
        }
        this.file()!.groups.push(checklistGroup);
      }
      this._reloadFile(true);
      // Leave checklist unset
    }
    this._selectChecklist(checklist, checklistGroup);
  }

  groupEnterPredicate(enter: CdkDrag<ChecklistTreeNode>): boolean {
    return !enter.data.checklist;
  }

  groupDropSortPredicate(index: number, item: CdkDrag<ChecklistTreeNode>): boolean {
    return !item.data.isAddNew && !item.data.checklist;
  }

  onGroupDrop(event: CdkDragDrop<ChecklistTreeNode>): void {
    const file = this.file();
    if (!file) return;

    const groups = file.groups;
    moveItemInArray(groups, event.previousIndex, event.currentIndex);

    // Rebuild the nodes with updated data.
    this._reloadFile(true);

    // The selected checklist itself didn't change, but the fragment to represent may have.
    this._selectChecklist(this.selectedChecklist(), this.selectedChecklistGroup());
    this._scrollToSelectedChecklist();
  }

  onLeafEntered(event: CdkDragEnter<ChecklistTreeNode, ChecklistTreeNode | ChecklistItem>) {
    this._preparePlaceholder(event.container, event.item, true);
  }

  onLeafExited(event: CdkDragExit<ChecklistTreeNode, ChecklistTreeNode | ChecklistItem>) {
    this._preparePlaceholder(event.container, event.item, false);
  }

  leafEnterPredicate(enter: CdkDrag<ChecklistTreeNode | ChecklistItem>): boolean {
    const data = enter.data;
    if (ChecklistItem.is(data)) {
      return true;
    } else {
      // ChecklistTreeNode
      return Boolean(data.checklist);
    }
  }

  leafDropSortPredicate(
    dropGroupIdx: number,
    index: number,
    item: CdkDrag<ChecklistTreeNode | ChecklistItem>,
  ): boolean {
    const file = this.file();
    if (!file) return false;

    if (ChecklistItem.is(item.data)) {
      // Due to https://github.com/angular/components/issues/23766, we get a bogus
      // index. Unlike in onLeafDrop, however, we don't get enough information to
      // determine it, and we don't even get called again as the item gets dragged
      // onto other elements because Angular thinks the index hasn't changed - so
      // our only option is to return true here and let onLeafDrop reject a bad
      // drop location. Since we hide the placeholder anyway, this should be fine.
      return true;
    } else {
      // Disallow dropping after "Add checklist" node.
      return index < file.groups[dropGroupIdx].checklists.length;
    }
  }

  onLeafDrop(
    event: CdkDragDrop<ChecklistTreeNode, ChecklistTreeNode | ChecklistItem[], ChecklistTreeNode | ChecklistItem>,
  ): void {
    if (ChecklistItem.is(event.item.data)) {
      const prevItems = event.previousContainer.data as ChecklistItem[];
      const prevItemIdx = event.previousIndex;
      const newGroupIdx = event.container.data.groupIdx!;
      const dropElement = event.event.target as HTMLElement;

      this._onChecklistItemDrop(prevItems, prevItemIdx, newGroupIdx, dropElement);
    } else {
      const prevContainer = event.previousContainer as CdkDropList<ChecklistTreeNode>;
      this._onChecklistDrop(event.container, prevContainer, event.currentIndex, event.previousIndex);
    }
    this._preparePlaceholder(event.container, event.item, false);
  }

  private _onChecklistItemDrop(
    previousItems: ChecklistItem[],
    previousItemIdx: number,
    newGroupIdx: number,
    dropElement: HTMLElement,
  ) {
    const file = this.file();
    if (!file) return;

    const previousPos = this.selectedChecklistPosition();
    if (!previousPos) return;

    // Due to https://github.com/angular/components/issues/23766, we get a bogus
    // event.currentIndex, and must manually determine what checklist the item was
    // dropped on.
    const treeNodeElement = dropElement.closest('.checklist-tree-node');
    if (!treeNodeElement) return;

    const groupIdxAttr = treeNodeElement.attributes.getNamedItem('groupIdx');
    const checklistIdxAttr = treeNodeElement.attributes.getNamedItem('checklistIdx');
    if (!checklistIdxAttr || !groupIdxAttr) return;

    const groupIdxFromAttr = parseInt(groupIdxAttr.value, 10);
    if (groupIdxFromAttr !== newGroupIdx) {
      console.error(`Mismatch in group index: ${newGroupIdx} vs ${groupIdxAttr.value}`);
    }

    const newChecklistIdx = parseInt(checklistIdxAttr.value, 10);
    const newItems = file.groups[newGroupIdx].checklists[newChecklistIdx].items;

    transferArrayItem(previousItems, newItems, previousItemIdx, newItems.length);

    // We didn't change the tree structure, no reason to reload the tree, but we must
    // still notify that the file was modified.
    this.fileModified.emit(file);
  }

  private _onChecklistDrop(
    newContainer: CdkDropList<ChecklistTreeNode>,
    previousContainer: CdkDropList<ChecklistTreeNode>,
    newIndex: number,
    previousIndex: number,
  ) {
    const newGroup = newContainer.data.group!;
    if (previousContainer === newContainer) {
      moveItemInArray(newGroup.checklists, previousIndex, newIndex);
    } else {
      const oldGroup = previousContainer.data.group!;
      transferArrayItem(oldGroup.checklists, newGroup.checklists, previousIndex, newIndex);
    }

    // Rebuild the nodes with updated data.
    this._reloadFile(true);

    // The selected checklist itself didn't change, but the fragment to represent may have.
    this._selectChecklist(this.selectedChecklist(), newGroup);
    this._scrollToSelectedChecklist();
  }

  private _preparePlaceholder(
    container: CdkDropList<ChecklistTreeNode>,
    drag: CdkDrag<ChecklistTreeNode | ChecklistItem>,
    draggingState: boolean,
  ) {
    this.dragging = draggingState;

    if (ChecklistItem.is(drag.data)) {
      // We want placeholder for checklist items to be completely hidden so it looks
      // like items are being dragged on top of a checklist. We accomplish this by
      // setting additional styles on the placeholder, and disabling sorting temporarily.
      const placeholder = drag.getPlaceholderElement() as HTMLElement | null;
      if (placeholder) {
        const classes = placeholder.classList;
        if (draggingState) {
          classes.add('cdk-drag-placeholder-into-tree');
        } else {
          classes.remove('cdk-drag-placeholder-into-tree');
        }
      }
      container.sortingDisabled = draggingState;
      container._dropListRef.sortingDisabled = draggingState;
    }
  }

  private _findNextChecklist(direction: MovementDirection): ChecklistPosition | undefined {
    const file = this.file();
    if (!file) return undefined;
    const groups = file.groups;
    const numGroups = groups.length;
    if (!numGroups) return undefined; // Empty file

    const next = direction === 'down';
    const selectedPos = this.selectedChecklistPosition();
    let checklistIdx, groupIdx: number;
    if (!selectedPos) {
      // Nothing was selected - pretend something before the first or after the last checklist was,
      // and it'll get advanced onto the first or last checklist.
      groupIdx = next ? 0 : groups.length - 1;
      checklistIdx = next ? -1 : groups[groupIdx].checklists.length;
    } else {
      ({ groupIdx, checklistIdx } = selectedPos);
    }

    // If it's the last checklist on the current group, wrap to next group that has a checklist.
    let group = groups[groupIdx];
    const delta = next ? 1 : -1;
    const lastChecklistIdx = next ? group.checklists.length - 1 : 0;
    const afterLastGroupIdx = next ? numGroups : -1;
    if (checklistIdx === lastChecklistIdx) {
      groupIdx += delta;

      while (groupIdx !== afterLastGroupIdx) {
        group = groups[groupIdx];
        if (group.checklists.length > 0) {
          break;
        }
        groupIdx += delta;
      }
      if (groupIdx === afterLastGroupIdx) {
        // This was the last checklist of the last group (that has checklists) already.
        return undefined;
      }
      checklistIdx = next ? 0 : group.checklists.length - 1;
    } else {
      checklistIdx += delta;
    }

    return { groupIdx, checklistIdx };
  }

  selectNextChecklist() {
    this._selectNextChecklist('down');
  }

  selectPreviousChecklist() {
    this._selectNextChecklist('up');
  }

  selectNextGroup() {
    this._selectNextGroup('down');
  }

  selectPreviousGroup() {
    this._selectNextGroup('up');
  }

  moveCurrentChecklistUp() {
    this._moveCurrentChecklist('up');
  }

  moveCurrentChecklistDown() {
    this._moveCurrentChecklist('down');
  }

  moveCurrentGroupUp() {
    this._moveCurrentGroup('up');
  }

  moveCurrentGroupDown() {
    this._moveCurrentGroup('down');
  }

  private _selectNextChecklist(direction: MovementDirection) {
    const file = this.file();
    if (!file) return;
    const next = this._findNextChecklist(direction);
    if (!next) return;

    const { groupIdx, checklistIdx } = next;
    const group = file.groups[groupIdx];
    this._selectChecklist(group.checklists[checklistIdx], group);
    this._scrollToSelectedChecklist();
  }

  private _moveCurrentChecklist(direction: MovementDirection) {
    const file = this.file();
    if (!file) return;

    const currentPos = this.selectedChecklistPosition();
    if (!currentPos) return;

    const upDirection = direction === 'up';
    const delta = upDirection ? -1 : 1;

    // Whether we're at the last group in the given direction.
    const lastGroupIdx = upDirection ? 0 : file.groups.length - 1;
    const lastGroup = currentPos.groupIdx === lastGroupIdx;

    let newPos = this._findNextChecklist(direction);

    if (!newPos && lastGroup) {
      // There's nothing after the current position to move into.
      return;
    }

    if (!newPos || Math.abs(newPos.groupIdx - currentPos.groupIdx) > 1) {
      // There's an empty group right after this one - move into that.
      newPos = {
        checklistIdx: 0,
        groupIdx: currentPos.groupIdx + delta,
      };
    }

    const currentGroup = file.groups[currentPos.groupIdx];
    const newGroup = file.groups[newPos.groupIdx];

    if (newGroup === currentGroup) {
      // Swap the checklists in the model.
      [currentGroup.checklists[currentPos.checklistIdx], newGroup.checklists[newPos.checklistIdx]] = [
        newGroup.checklists[newPos.checklistIdx],
        currentGroup.checklists[currentPos.checklistIdx],
      ];
    } else {
      // Swapping would move a checklist from the other group into the current one - must delete and insert instead.
      const movedChecklist = currentGroup.checklists.splice(currentPos.checklistIdx, 1)[0];
      const newChecklistIdx = newPos.checklistIdx + (upDirection ? 1 : 0);
      newGroup.checklists.splice(newChecklistIdx, 0, movedChecklist);
    }

    // The checklist may have moved between groups - update the selected group.
    this.selectedChecklistGroup.set(newGroup);

    // Update the tree nodes.
    this._reloadFile(true);

    // The selected checklist itself didn't change, but the fragment to represent it did.
    this._selectChecklist(this.selectedChecklist(), newGroup);
    this._scrollToSelectedChecklist();
  }

  private _findNextGroup(direction: MovementDirection): number | undefined {
    const file = this.file();
    if (!file) return undefined;

    const next = direction === 'down';
    const selectedPos = this.selectedChecklistPosition();
    let groupIdx: number;
    if (!selectedPos) {
      // Nothing selected - pretend something before the first or after the last group was.
      groupIdx = next ? -1 : file.groups.length;
    } else if (selectedPos.groupIdx === (next ? file.groups.length - 1 : 0)) {
      // Already at the last/first group
      return undefined;
    } else {
      groupIdx = selectedPos.groupIdx;
    }

    if (next) {
      return groupIdx + 1;
    } else {
      return groupIdx - 1;
    }
  }

  private _selectNextGroup(direction: MovementDirection) {
    const file = this.file();
    if (!file) return;
    let groupIdx = this._findNextGroup(direction);
    if (groupIdx === undefined) return;

    // What we're really selecting is a checklist in the next group that has one - so
    // advance the group until we find one.
    // If in the future we allow selection of empty groups, we can change this.
    const delta = direction === 'down' ? 1 : -1;
    while (!file.groups[groupIdx].checklists.length) {
      groupIdx += delta;
      if (groupIdx === file.groups.length || groupIdx === -1) {
        // Only found empty groups after the current one.
        return;
      }
    }

    const group = file.groups[groupIdx];
    const checklist = group.checklists[0];

    this._selectChecklist(checklist, group);
    this._scrollToSelectedChecklist();
  }

  private _moveCurrentGroup(direction: MovementDirection) {
    const newGroupIdx = this._findNextGroup(direction);
    if (newGroupIdx === undefined) return;

    const file = this.file();
    if (!file) return;
    const currentPos = this.selectedChecklistPosition();
    if (!currentPos) return;
    const currentGroupIdx = currentPos.groupIdx;

    // Swap the groups in the model.
    [file.groups[currentGroupIdx], file.groups[newGroupIdx]] = [file.groups[newGroupIdx], file.groups[currentGroupIdx]];

    // Update the tree nodes.
    this._reloadFile(true);

    // The selected checklist/group themselves didn't change, but the fragment to represent them did.
    this._selectChecklist(this.selectedChecklist(), this.selectedChecklistGroup());
    this._scrollToSelectedChecklist();
  }

  private _selectChecklist(checklist?: Checklist, group?: ChecklistGroup) {
    this.selectedChecklist.set(checklist);
    this.selectedChecklistGroup.set(group);
  }

  private _scrollToSelectedChecklist() {
    if (!this.selectedChecklist()) return;

    let selectedNode, selectedGroupNode: ChecklistTreeNode | undefined;
    let firstChecklist = true;
    for (const groupNode of this.dataSource.data) {
      if (groupNode.group === this.selectedChecklistGroup()) {
        selectedGroupNode = groupNode;
      }

      if (!groupNode.children) continue;
      firstChecklist = true;
      for (const checklistNode of groupNode.children) {
        if (checklistNode.checklist === this.selectedChecklist()) {
          selectedNode = checklistNode;
          break;
        }
        firstChecklist = false;
      }
    }
    if (!selectedGroupNode) {
      console.error("Couldn't find selected tree node");
      return;
    }

    // Expand the tree to make the node visible.
    const tree = this.tree();
    if (!tree.isExpanded(selectedGroupNode)) {
      tree.expand(selectedGroupNode);
    }

    let nodeClass = '.checklist-selected';
    if (firstChecklist || !selectedNode) {
      nodeClass += ', .group-selected';
    }

    // Nodes may need to be (re)created after the above, delay the actual scrolling.
    afterNextRender(
      () => {
        const selectedElements = this._element.nativeElement.querySelectorAll(nodeClass);
        if (!selectedElements.length) {
          console.error('Could not find element for selected node');
          return;
        }

        // Note: this will only work in future versions of Chrome, due to
        // https://issues.chromium.org/issues/325081538
        // Until then, only the last element will be scrolled into, meaning that when scrolling down,
        // we'll correctly scroll into the checklist and the group will become visible, but when
        // scrolling up the group will not come into view.
        selectedElements.forEach((el: Element) => {
          scrollIntoView(el, {
            scrollMode: 'if-needed',
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest',
          });
        });
      },
      { injector: this._injector },
    );
  }

  selectedChecklistPosition(): ChecklistPosition | undefined {
    const file = this.file();
    if (!file || !this.selectedChecklist()) return undefined;

    // Find the currently selected checklist
    const groups = file.groups;
    let currentGroupIdx: number;
    let currentChecklistIdx: number | undefined;
    findloop: for (currentGroupIdx = 0; currentGroupIdx < groups.length; currentGroupIdx++) {
      const checklists = groups[currentGroupIdx].checklists;
      for (currentChecklistIdx = 0; currentChecklistIdx < checklists.length; currentChecklistIdx++) {
        const checklist = checklists[currentChecklistIdx];
        if (checklist === this.selectedChecklist()) {
          break findloop;
        }
      }
    }
    if (currentGroupIdx === groups.length || currentChecklistIdx === undefined) {
      // Current checklist not found.
      return undefined;
    }
    return { groupIdx: currentGroupIdx, checklistIdx: currentChecklistIdx };
  }

  async onChecklistRename(node: ChecklistTreeNode) {
    if (await this._fillTitle(node.checklist!, 'checklist')) {
      this._reloadFile(true);
    }
  }

  onChecklistDelete(node: ChecklistTreeNode) {
    // Update the default checklist index if needed.
    const file = this.file();
    if (
      file?.metadata &&
      file.metadata.defaultGroupIndex === node.groupIdx &&
      file.metadata.defaultChecklistIndex >= node.checklistIdx! &&
      file.metadata.defaultChecklistIndex > 0
    ) {
      file.metadata.defaultChecklistIndex--;
    }

    node.group!.checklists.splice(node.checklistIdx!, 1);
    if (this.selectedChecklist() === node.checklist!) {
      this._selectChecklist(undefined, node.group);
    }
    this._reloadFile(true);
  }

  async onGroupRename(node: ChecklistTreeNode) {
    if (await this._fillTitle(node.group!, 'checklist group')) {
      this._reloadFile(true);
    }
  }

  onGroupDelete(node: ChecklistTreeNode) {
    // Update the default group index if needed.
    const file = this.file();
    if (file?.metadata) {
      if (file.metadata.defaultGroupIndex === node.groupIdx) {
        // The group containing the current default was deleted, reset.
        file.metadata.defaultGroupIndex = 0;
        file.metadata.defaultChecklistIndex = 0;
      } else if (file.metadata.defaultGroupIndex > node.groupIdx!) {
        // The default comes after the deleted group, just shift it.
        file.metadata.defaultGroupIndex--;
      }
    }

    this.file()!.groups.splice(node.groupIdx!, 1);
    if (this.selectedChecklistGroup() === node.group!) {
      this._selectChecklist(undefined, undefined);
    }
    this._reloadFile(true);
  }

  isAllExpanded(): boolean {
    return this.dataSource.data.every((node: ChecklistTreeNode) => this.tree().isExpanded(node));
  }

  isAllCollapsed(): boolean {
    return !this.dataSource.data.some((node: ChecklistTreeNode) => this.tree().isExpanded(node));
  }

  expandAll() {
    this.tree().expandAll();
  }

  collapseAll() {
    this.tree().collapseAll();
  }

  private async _fillTitle(pb: Checklist | ChecklistGroup, promptType: string): Promise<boolean> {
    const title = await TitleDialogComponent.promptForTitle(
      {
        promptType: promptType,
        initialTitle: pb.title,
      },
      this._dialog,
    );

    if (!title) {
      return false;
    }
    pb.title = title; // eslint-disable-line require-atomic-updates
    return true;
  }
}
