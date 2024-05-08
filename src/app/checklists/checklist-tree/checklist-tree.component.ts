import { NestedTreeControl } from '@angular/cdk/tree';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTreeModule, MatTreeNestedDataSource } from '@angular/material/tree';
import { Checklist, ChecklistFile, ChecklistGroup } from '../../../../gen/ts/checklist';
import { ChecklistTreeNode } from './node/node';
import { ChecklistTreeNodeComponent } from './node/node.component';

@Component({
  selector: 'checklist-tree',
  standalone: true,
  imports: [
    ChecklistTreeNodeComponent,
    MatButtonModule,
    MatIconModule,
    MatTreeModule,
  ],
  templateUrl: './checklist-tree.component.html',
  styleUrl: './checklist-tree.component.scss'
})
export class ChecklistTreeComponent {
  @Output() selectedChecklist: Checklist | undefined;
  @Output() selectedChecklistGroup: ChecklistGroup | undefined;
  @Output() checklistSelected = new EventEmitter<Checklist | undefined>();
  @Output() checklistStructureChanged = new EventEmitter<ChecklistFile>();

  treeControl = new NestedTreeControl<ChecklistTreeNode>(node => node.children);
  dataSource = new MatTreeNestedDataSource<ChecklistTreeNode>();
  private _file?: ChecklistFile;

  @Input()
  get file(): ChecklistFile | undefined { return this._file; }
  set file(file: ChecklistFile | undefined) {
    this._file = file;
    this.reloadFile(false);
    this.selectedChecklistGroup = undefined;
    this.selectedChecklist = undefined;
    this.checklistSelected.emit();
  }

  private reloadFile(modified: boolean) {
    let data: ChecklistTreeNode[] = [];
    if (this._file) {
      data = this._file.groups.map(ChecklistTreeComponent.groupToNode);
      data.push({
        title: "Add new checklist group",
        isAddNew: true,
      });
    }

    this.dataSource.data = data;
    this.treeControl.dataNodes = data;
    this.treeControl.expandAll();

    if (modified) {
      this.checklistStructureChanged.emit(this._file);
    }
  }

  private static groupToNode(group: ChecklistGroup, groupIdx: number): ChecklistTreeNode {
    const node: ChecklistTreeNode = {
      title: group.title,
      group: group,
      groupIdx: groupIdx,
      children: group.checklists.map(
        (checklist, checklistIdx) => ({
          title: checklist.title,
          group: group,
          groupIdx: groupIdx,
          checklist: checklist,
          checklistIdx: checklistIdx,
          isAddNew: false,
        })
      ),
      isAddNew: false,
    };
    node.children?.push({
      title: "Add new checklist",
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
        if (!this.fillTitle(checklist, "checklist")) {
          return;
        }
        checklistGroup = node.group;
        node.group.checklists.push(checklist);
      } else {
        // Adding new group to the file.
        checklistGroup = ChecklistGroup.create();
        if (!this.fillTitle(checklistGroup, "checklist group")) {
          return;
        }
        this._file!.groups.push(checklistGroup);
      }
      this.reloadFile(true);
      // Leave checklist unset
    }

    this.selectedChecklist = checklist;
    this.selectedChecklistGroup = checklistGroup;
    this.checklistSelected.emit(checklist);
  }

  onChecklistRename(node: ChecklistTreeNode) {
    this.fillTitle(node.checklist!, "checklist");
    this.reloadFile(true);
  }

  onChecklistDelete(node: ChecklistTreeNode) {
    if (!confirm(`Are you sure you'd like to delete checklist "${node.checklist!.title}"??`)) return;

    node.group!.checklists.splice(node.checklistIdx!, 1)
    if (this.selectedChecklist === node.checklist!) {
      this.selectedChecklist = undefined;
      this.checklistSelected.emit(undefined);
    }
    this.reloadFile(true);
  }

  onGroupRename(node: ChecklistTreeNode) {
    this.fillTitle(node.group!, "checklist group");
    this.reloadFile(true);
  }

  onGroupDelete(node: ChecklistTreeNode) {
    if (!confirm(`Are you sure you'd like to delete checklist group "${node.group!.title}" and all checklists within??`)) return;

    this._file!.groups.splice(node.groupIdx!, 1);
    if (this.selectedChecklistGroup === node.group!) {
      this.selectedChecklist = undefined;
      this.selectedChecklistGroup = undefined;
      this.checklistSelected.emit(undefined);
    }
    this.reloadFile(true);
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
