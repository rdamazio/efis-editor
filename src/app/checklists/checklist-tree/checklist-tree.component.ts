import { NestedTreeControl } from '@angular/cdk/tree';
import { afterNextRender, Component, ElementRef, EventEmitter, Injector, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTreeModule, MatTreeNestedDataSource } from '@angular/material/tree';
import { MatIconButtonSizesModule } from 'mat-icon-button-sizes';
import { Checklist, ChecklistFile, ChecklistGroup } from '../../../../gen/ts/checklist';
import { ChecklistTreeNode } from './node/node';
import { ChecklistTreeNodeComponent } from './node/node.component';

@Component({
  selector: 'checklist-tree',
  standalone: true,
  imports: [ChecklistTreeNodeComponent, MatButtonModule, MatIconButtonSizesModule, MatIconModule, MatTreeModule],
  templateUrl: './checklist-tree.component.html',
  styleUrl: './checklist-tree.component.scss',
})
export class ChecklistTreeComponent {
  // TODO: Make this a get/set so we can focus on external set
  @Input() selectedChecklist: Checklist | undefined;
  @Output() selectedChecklistChange = new EventEmitter<Checklist | undefined>();
  @Output() selectedChecklistGroup: ChecklistGroup | undefined;

  treeControl = new NestedTreeControl<ChecklistTreeNode>((node) => node.children);
  dataSource = new MatTreeNestedDataSource<ChecklistTreeNode>();
  private _file?: ChecklistFile;

  constructor(
    private _element: ElementRef,
    private _injector: Injector,
  ) {}

  @Output() fileChange = new EventEmitter<ChecklistFile>();
  @Input()
  get file(): ChecklistFile | undefined {
    return this._file;
  }
  set file(file: ChecklistFile | undefined) {
    this._file = file;
    this.reloadFile(false);
    if (this.selectedChecklist || this.selectedChecklistGroup) {
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
    this.treeControl.dataNodes = data;
    this.treeControl.expandAll();

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

  hasChild = (_: number, node: ChecklistTreeNode) => !!node.children && node.children.length > 0;

  onNodeSelect(node: ChecklistTreeNode) {
    let checklist: Checklist | undefined;
    let checklistGroup: ChecklistGroup | undefined;
    if (!node.isAddNew) {
      checklist = node.checklist!;
      checklistGroup = node.group!;
    } else {
      if (node.group) {
        // Adding new checklist to a group.
        checklist = Checklist.create();
        if (!this.fillTitle(checklist, 'checklist')) {
          return;
        }
        checklistGroup = node.group;
        node.group.checklists.push(checklist);
      } else {
        // Adding new group to the file.
        checklistGroup = ChecklistGroup.create();
        if (!this.fillTitle(checklistGroup, 'checklist group')) {
          return;
        }
        this._file!.groups.push(checklistGroup);
      }
      this.reloadFile(true);
      // Leave checklist unset
    }
    this._selectChecklist(checklist, checklistGroup);
  }

  selectNextChecklist() {
    if (!this._file) return;
    const groups = this._file.groups;
    const numGroups = groups.length;
    if (!numGroups) return; // Empty file

    let { groupIdx, checklistIdx } = this._findSelectedChecklist();
    if (groupIdx === undefined || checklistIdx === undefined) {
      // Nothing was selected - pretend something before the first checklist was,
      // and it'll get advanced onto the first checklist.
      groupIdx = 0;
      checklistIdx = -1;
    }

    // If it's the last checklist on the current group, wrap to next group that has a checklist.
    let group = groups[groupIdx];
    if (checklistIdx === group.checklists.length - 1) {
      checklistIdx = 0;
      groupIdx++;
      while (groupIdx < numGroups) {
        group = groups[groupIdx];
        if (group.checklists.length > 0) {
          break;
        }
        groupIdx++;
      }
      if (groupIdx === numGroups) {
        // This was the last checklist of the last group (that has checklists) already.
        return;
      }
    } else {
      checklistIdx++;
    }

    this._selectChecklist(group.checklists[checklistIdx], group);
    this._scrollToSelectedChecklist();
  }

  selectPreviousChecklist() {
    if (!this._file) return;
    const groups = this._file.groups;
    const numGroups = groups.length;
    if (!numGroups) return; // Empty file

    let { groupIdx, checklistIdx } = this._findSelectedChecklist();
    if (groupIdx === undefined || checklistIdx === undefined) {
      // Nothing was selected - pretend something after the last checklist was,
      // and it'll get rewinded onto the last checklist.
      groupIdx = groups.length - 1;
      checklistIdx = groups[groupIdx].checklists.length;
    }

    // If it's the first checklist on the current group, wrap to prior group that has a checklist.
    let group = groups[groupIdx];
    if (checklistIdx === 0) {
      groupIdx--;
      while (groupIdx >= 0) {
        group = groups[groupIdx];
        if (group.checklists.length > 0) {
          break;
        }
        groupIdx--;
      }
      if (groupIdx === -1) {
        // This was the first checklist of the first group (that has checklists) already.
        return;
      }
      checklistIdx = group.checklists.length - 1;
    } else {
      checklistIdx--;
    }

    this._selectChecklist(group.checklists[checklistIdx], group);
    this._scrollToSelectedChecklist();
  }

  private _selectChecklist(checklist?: Checklist, group?: ChecklistGroup) {
    this.selectedChecklist = checklist;
    this.selectedChecklistGroup = group;
    this.selectedChecklistChange.emit(checklist);
  }

  private _scrollToSelectedChecklist() {
    if (!this.selectedChecklist) return;

    let selectedNode, selectedGroupNode: ChecklistTreeNode | undefined;
    for (const groupNode of this.treeControl.dataNodes) {
      if (!groupNode || !groupNode.children) continue;
      for (const checklistNode of groupNode.children) {
        if (checklistNode.checklist === this.selectedChecklist) {
          selectedNode = checklistNode;
          selectedGroupNode = groupNode;
          break;
        }
      }
    }
    if (!selectedNode || !selectedGroupNode) {
      console.error("Couldn't find selected tree node");
      return;
    }

    // Expand the tree to make the node visible.
    if (!this.treeControl.isExpanded(selectedGroupNode)) {
      this.treeControl.expand(selectedGroupNode);
    }

    // Nodes may need to be (re)created after the above, delay the actual scrolling.
    afterNextRender(
      () => {
        const selectedElements = this._element.nativeElement.querySelectorAll('.checklist-selected');
        if (selectedElements.length !== 1) {
          console.error('Could not find element for selected node');
          return;
        }
        selectedElements[0].scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest',
        });
      },
      { injector: this._injector },
    );
  }

  private _findSelectedChecklist(): { groupIdx?: number; checklistIdx?: number } {
    if (!this._file || !this.selectedChecklist) return { groupIdx: undefined, checklistIdx: undefined };

    // Find the currently selected checklist
    const groups = this._file.groups;
    let currentGroupIdx: number | undefined;
    let currentChecklistIdx: number | undefined;
    findloop: for (currentGroupIdx = 0; currentGroupIdx < groups.length; currentGroupIdx++) {
      const checklists = groups[currentGroupIdx].checklists;
      for (currentChecklistIdx = 0; currentChecklistIdx < checklists.length; currentChecklistIdx++) {
        const checklist = checklists[currentChecklistIdx];
        if (checklist === this.selectedChecklist) {
          break findloop;
        }
      }
    }
    if (currentGroupIdx === groups.length) {
      // Current checklist not found.
      return { groupIdx: undefined, checklistIdx: undefined };
    }
    return { groupIdx: currentGroupIdx, checklistIdx: currentChecklistIdx };
  }

  onChecklistRename(node: ChecklistTreeNode) {
    this.fillTitle(node.checklist!, 'checklist');
    this.reloadFile(true);
  }

  onChecklistDelete(node: ChecklistTreeNode) {
    if (!confirm(`Are you sure you'd like to delete checklist "${node.checklist!.title}"??`)) return;

    // Update the default checklist index if needed.
    if (
      this.file &&
      this.file.metadata &&
      this.file.metadata.defaultGroupIndex === node.groupIdx &&
      this.file.metadata.defaultChecklistIndex! >= node.checklistIdx! &&
      this.file.metadata.defaultChecklistIndex > 0
    ) {
      this.file.metadata.defaultChecklistIndex--;
    }

    node.group!.checklists.splice(node.checklistIdx!, 1);
    if (this.selectedChecklist === node.checklist!) {
      this._selectChecklist(undefined, node.group!);
    }
    this.reloadFile(true);
  }

  onGroupRename(node: ChecklistTreeNode) {
    this.fillTitle(node.group!, 'checklist group');
    this.reloadFile(true);
  }

  onGroupDelete(node: ChecklistTreeNode) {
    if (
      !confirm(`Are you sure you'd like to delete checklist group "${node.group!.title}" and all checklists within??`)
    )
      return;

    // Update the default group index if needed.
    if (this.file && this.file.metadata) {
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
    return this.dataSource.data.every((node) => this.treeControl.isExpanded(node));
  }

  isAllCollapsed(): boolean {
    return this.treeControl.expansionModel.isEmpty();
  }

  expandAll() {
    this.treeControl.expandAll();
  }

  collapseAll() {
    this.treeControl.collapseAll();
  }

  private fillTitle(pb: Checklist | ChecklistGroup, promptType: string): boolean {
    const title = prompt(`Enter ${promptType} title:`, pb.title);
    if (!title) {
      return false;
    }
    pb.title = title;
    return true;
  }
}
