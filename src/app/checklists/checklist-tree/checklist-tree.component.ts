import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import {
  afterNextRender,
  Component,
  ElementRef,
  EventEmitter,
  Injector,
  Input,
  Output,
  QueryList,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTree, MatTreeModule, MatTreeNestedDataSource } from '@angular/material/tree';
import { MatIconButtonSizesModule } from 'mat-icon-button-sizes';
import scrollIntoView from 'scroll-into-view-if-needed';
import Swal from 'sweetalert2/dist/sweetalert2.js';
import { Checklist, ChecklistFile, ChecklistGroup } from '../../../../gen/ts/checklist';
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
  standalone: true,
  imports: [
    CdkDrag,
    CdkDropList,
    ChecklistDragDirective,
    ChecklistTreeNodeComponent,
    MatButtonModule,
    MatIconButtonSizesModule,
    MatIconModule,
    MatTreeModule,
  ],
  templateUrl: './checklist-tree.component.html',
  styleUrl: './checklist-tree.component.scss',
})
export class ChecklistTreeComponent {
  @Output() selectedChecklistGroup: ChecklistGroup | undefined;
  @ViewChild(MatTree) tree: MatTree<ChecklistTreeNode> | undefined;
  @ViewChildren(CdkDropList) allDropLists?: QueryList<CdkDropList<ChecklistTreeNode>>;
  dataSource = new MatTreeNestedDataSource<ChecklistTreeNode>();
  private _file?: ChecklistFile;
  private _selectedChecklist?: Checklist;

  constructor(
    private readonly _element: ElementRef<Element>,
    private readonly _injector: Injector,
  ) {}

  @Output() selectedChecklistChange = new EventEmitter<Checklist | undefined>();
  @Input() get selectedChecklist(): Checklist | undefined {
    return this._selectedChecklist;
  }
  set selectedChecklist(checklist: Checklist | undefined) {
    this._selectedChecklist = checklist;
    this._scrollToSelectedChecklist();
  }

  @Output() fileChange = new EventEmitter<ChecklistFile>();
  @Input()
  get file(): ChecklistFile | undefined {
    return this._file;
  }
  set file(file: ChecklistFile | undefined) {
    this._file = file;
    this.reloadFile(false);
    if (this._selectedChecklist || this.selectedChecklistGroup) {
      this._selectChecklist(undefined, undefined);
    }
  }

  private reloadFile(modified: boolean) {
    let data: ChecklistTreeNode[] = [];
    if (this._file) {
      data = this._file.groups.map(ChecklistTreeComponent.groupToNode);
      data.push({
        title: 'Add new checklist group',
        isAddNew: true,
      });
    }

    this.dataSource.data = data;
    this.tree!.expandAll();

    if (modified) {
      this.fileChange.emit(this._file);
    }
  }

  private static groupToNode(group: ChecklistGroup, groupIdx: number): ChecklistTreeNode {
    const node: ChecklistTreeNode = {
      title: group.title,
      group: group,
      groupIdx: groupIdx,
      children: group.checklists.map((checklist, checklistIdx) => ({
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

  hasChild = (_: number, node: ChecklistTreeNode) => node.children && node.children.length > 0;
  childrenAccessor = (node: ChecklistTreeNode) => node.children ?? [];

  async onNodeSelect(node: ChecklistTreeNode) {
    let checklist: Checklist | undefined;
    let checklistGroup: ChecklistGroup | undefined;
    if (!node.isAddNew) {
      checklist = node.checklist!;
      checklistGroup = node.group!;
    } else {
      if (node.group) {
        // Adding new checklist to a group.
        checklist = Checklist.create();
        if (!(await this.fillTitle(checklist, 'checklist'))) {
          return;
        }
        checklistGroup = node.group;
        node.group.checklists.push(checklist);
      } else {
        // Adding new group to the file.
        checklistGroup = ChecklistGroup.create();
        if (!(await this.fillTitle(checklistGroup, 'checklist group'))) {
          return;
        }
        this._file!.groups.push(checklistGroup);
      }
      this.reloadFile(true);
      // Leave checklist unset
    }
    this._selectChecklist(checklist, checklistGroup);
  }

  onGroupDrop(event: CdkDragDrop<ChecklistTreeNode>): void {
    if (!this._file) return;

    const groups = this._file.groups;
    moveItemInArray(groups, event.previousIndex, event.currentIndex);

    // Rebuild the nodes with updated data.
    this.reloadFile(true);

    // The selected checklist itself didn't change, but the fragment to represent may have.
    this._selectChecklist(this.selectedChecklist, this.selectedChecklistGroup);
    this._scrollToSelectedChecklist();
  }

  onChecklistDrop(event: CdkDragDrop<ChecklistTreeNode>): void {
    const newGroup = event.container.data.group!;
    if (event.previousContainer === event.container) {
      moveItemInArray(newGroup.checklists, event.previousIndex, event.currentIndex);
    } else {
      const oldGroup = event.previousContainer.data.group!;
      transferArrayItem(oldGroup.checklists, newGroup.checklists, event.previousIndex, event.currentIndex);
    }

    // Rebuild the nodes with updated data.
    this.reloadFile(true);

    // The selected checklist itself didn't change, but the fragment to represent may have.
    this._selectChecklist(this.selectedChecklist, newGroup);
    this._scrollToSelectedChecklist();
  }

  groupEnterPredicate(enter: CdkDrag<ChecklistTreeNode>): boolean {
    return !enter.data.checklist;
  }

  checklistEnterPredicate(enter: CdkDrag<ChecklistTreeNode>): boolean {
    return Boolean(enter.data.checklist);
  }

  groupDropSortPredicate(index: number, item: CdkDrag<ChecklistTreeNode>): boolean {
    return !item.data.isAddNew && !item.data.checklist;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  checklistDropSortPredicate(dropGroupIdx: number, index: number, item: CdkDrag<ChecklistTreeNode>): boolean {
    if (!this._file) return false;

    // Disallow dropping after "Add checklist" node.
    return index < this._file.groups[dropGroupIdx].checklists.length;
  }

  allGroupIds(): string[] {
    if (!this._file) return [];

    // We could use allDropLists, but this is faster and can be done statically,
    // without an additional change detection cycle.
    return this._file.groups.map((v: ChecklistGroup, idx: number) => `group_${idx}`);
  }

  private _findNextChecklist(direction: MovementDirection): ChecklistPosition | undefined {
    if (!this._file) return undefined;
    const groups = this._file.groups;
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
    if (!this._file) return;
    const next = this._findNextChecklist(direction);
    if (!next) return;

    const { groupIdx, checklistIdx } = next;
    const group = this._file.groups[groupIdx];
    this._selectChecklist(group.checklists[checklistIdx], group);
    this._scrollToSelectedChecklist();
  }

  private _moveCurrentChecklist(direction: MovementDirection) {
    if (!this._file) return;

    const currentPos = this.selectedChecklistPosition();
    if (!currentPos) return;

    const upDirection = direction === 'up';
    const delta = upDirection ? -1 : 1;

    // Whether we're at the last group in the given direction.
    const lastGroupIdx = upDirection ? 0 : this._file.groups.length - 1;
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

    const currentGroup = this._file.groups[currentPos.groupIdx];
    const newGroup = this._file.groups[newPos.groupIdx];

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
    this.selectedChecklistGroup = newGroup;

    // Update the tree nodes.
    this.reloadFile(true);

    // The selected checklist itself didn't change, but the fragment to represent it did.
    this._selectChecklist(this.selectedChecklist, newGroup);
    this._scrollToSelectedChecklist();
  }

  private _findNextGroup(direction: MovementDirection): number | undefined {
    if (!this._file) return undefined;

    const next = direction === 'down';
    const selectedPos = this.selectedChecklistPosition();
    let groupIdx: number;
    if (!selectedPos) {
      // Nothing selected - pretend something before the first or after the last group was.
      groupIdx = next ? -1 : this._file.groups.length;
    } else if (selectedPos.groupIdx === (next ? this._file.groups.length - 1 : 0)) {
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
    if (!this._file) return;
    let groupIdx = this._findNextGroup(direction);
    if (groupIdx === undefined) return;

    // What we're really selecting is a checklist in the next group that has one - so
    // advance the group until we find one.
    // If in the future we allow selection of empty groups, we can change this.
    const delta = direction === 'down' ? 1 : -1;
    while (!this._file.groups[groupIdx].checklists.length) {
      groupIdx += delta;
      if (groupIdx === this._file.groups.length || groupIdx === -1) {
        // Only found empty groups after the current one.
        return;
      }
    }

    const group = this._file.groups[groupIdx];
    const checklist = group.checklists[0];

    this._selectChecklist(checklist, group);
    this._scrollToSelectedChecklist();
  }

  private _moveCurrentGroup(direction: MovementDirection) {
    const newGroupIdx = this._findNextGroup(direction);
    if (newGroupIdx === undefined) return;

    if (!this._file) return;
    const currentPos = this.selectedChecklistPosition();
    if (!currentPos) return;
    const currentGroupIdx = currentPos.groupIdx;

    // Swap the groups in the model.
    [this._file.groups[currentGroupIdx], this._file.groups[newGroupIdx]] = [
      this._file.groups[newGroupIdx],
      this._file.groups[currentGroupIdx],
    ];

    // Update the tree nodes.
    this.reloadFile(true);

    // The selected checklist/group themselves didn't change, but the fragment to represent them did.
    this._selectChecklist(this.selectedChecklist, this.selectedChecklistGroup);
    this._scrollToSelectedChecklist();
  }

  private _selectChecklist(checklist?: Checklist, group?: ChecklistGroup) {
    this._selectedChecklist = checklist;
    this.selectedChecklistGroup = group;
    this.selectedChecklistChange.emit(checklist);
  }

  private _scrollToSelectedChecklist() {
    if (!this._selectedChecklist) return;

    let selectedNode, selectedGroupNode: ChecklistTreeNode | undefined;
    let firstChecklist = true;
    for (const groupNode of this.dataSource.data) {
      if (groupNode.group === this.selectedChecklistGroup) {
        selectedGroupNode = groupNode;
      }

      if (!groupNode.children) continue;
      firstChecklist = true;
      for (const checklistNode of groupNode.children) {
        if (checklistNode.checklist === this._selectedChecklist) {
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
    if (!this.tree!.isExpanded(selectedGroupNode)) {
      this.tree!.expand(selectedGroupNode);
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
    if (!this._file || !this._selectedChecklist) return undefined;

    // Find the currently selected checklist
    const groups = this._file.groups;
    let currentGroupIdx: number;
    let currentChecklistIdx: number | undefined;
    findloop: for (currentGroupIdx = 0; currentGroupIdx < groups.length; currentGroupIdx++) {
      const checklists = groups[currentGroupIdx].checklists;
      for (currentChecklistIdx = 0; currentChecklistIdx < checklists.length; currentChecklistIdx++) {
        const checklist = checklists[currentChecklistIdx];
        if (checklist === this._selectedChecklist) {
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
    if (await this.fillTitle(node.checklist!, 'checklist')) {
      this.reloadFile(true);
    }
  }

  onChecklistDelete(node: ChecklistTreeNode) {
    // Update the default checklist index if needed.
    if (
      this.file?.metadata &&
      this.file.metadata.defaultGroupIndex === node.groupIdx &&
      this.file.metadata.defaultChecklistIndex >= node.checklistIdx! &&
      this.file.metadata.defaultChecklistIndex > 0
    ) {
      this.file.metadata.defaultChecklistIndex--;
    }

    node.group!.checklists.splice(node.checklistIdx!, 1);
    if (this._selectedChecklist === node.checklist!) {
      this._selectChecklist(undefined, node.group);
    }
    this.reloadFile(true);
  }

  async onGroupRename(node: ChecklistTreeNode) {
    if (await this.fillTitle(node.group!, 'checklist group')) {
      this.reloadFile(true);
    }
  }

  onGroupDelete(node: ChecklistTreeNode) {
    // Update the default group index if needed.
    if (this.file?.metadata) {
      if (this.file.metadata.defaultGroupIndex === node.groupIdx) {
        // The group containing the current default was deleted, reset.
        this.file.metadata.defaultGroupIndex = 0;
        this.file.metadata.defaultChecklistIndex = 0;
      } else if (this.file.metadata.defaultGroupIndex > node.groupIdx!) {
        // The default comes after the deleted group, just shift it.
        this.file.metadata.defaultGroupIndex--;
      }
    }

    this._file!.groups.splice(node.groupIdx!, 1);
    if (this.selectedChecklistGroup === node.group!) {
      this._selectChecklist(undefined, undefined);
    }
    this.reloadFile(true);
  }

  isAllExpanded(): boolean {
    return this.dataSource.data.every((node) => this.tree!.isExpanded(node));
  }

  isAllCollapsed(): boolean {
    return !this.dataSource.data.some((node: ChecklistTreeNode) => {
      return this.tree!.isExpanded(node);
    });
  }

  expandAll() {
    this.tree!.expandAll();
  }

  collapseAll() {
    this.tree!.collapseAll();
  }

  private async fillTitle(pb: Checklist | ChecklistGroup, promptType: string): Promise<boolean> {
    const result = await Swal.fire({
      title: `Enter ${promptType} title:`,
      input: 'text',
      inputPlaceholder: `My ${promptType} title`,
      inputValue: pb.title,
    });

    if (!result.isConfirmed) {
      return false;
    }
    pb.title = result.value as string; // eslint-disable-line require-atomic-updates
    return true;
  }
}
