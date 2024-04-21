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
  @Output() checklistSelected = new EventEmitter<Checklist | undefined>();
  @Output() checklistStructureChanged = new EventEmitter<ChecklistFile>();

  treeControl = new NestedTreeControl<ChecklistTreeNode>(node => node.children);
  dataSource = new MatTreeNestedDataSource<ChecklistTreeNode>();
  _file?: ChecklistFile;

  @Input()
  get file(): ChecklistFile | undefined { return this._file; }
  set file(file: ChecklistFile | undefined) {
    this._file = file;
    this.reloadFile(false);
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

  private static groupToNode(group: ChecklistGroup): ChecklistTreeNode {
    let node: ChecklistTreeNode = {
      title: group.title,
      group: group,
      children: group.checklists.map(
        checklist => ({
          title: checklist.title,
          group: group,
          checklist: checklist,
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
    if (!node.isAddNew) {
      checklist = node.checklist!;
    } else {
      if (node.group) {
        // Adding new checklist to a group.
        checklist = Checklist.create();
        if (!this.fillTitle(checklist, "checklist")) {
          return;
        }
        node.group.checklists.push(checklist);
      } else {
        // Adding new group to the file.
        let group = ChecklistGroup.create();
        if (!this.fillTitle(group, "checklist group")) {
          return;
        }
        this._file?.groups.push(group);
      }
      this.reloadFile(true);
      // Leave checklist unset
    }

    if (checklist) {
      this.checklistSelected.emit(checklist);
    }
  }

  onChecklistRename(node: ChecklistTreeNode) {
    this.fillTitle(node.checklist!, "checklist");
    this.reloadFile(true);
  }

  onChecklistDelete(node: ChecklistTreeNode) {
    window.alert("TODO");
  }

  onGroupRename(node: ChecklistTreeNode) {
    this.fillTitle(node.checklist!, "checklist group");
    this.reloadFile(true);
  }

  onGroupDelete(node: ChecklistTreeNode) {
    window.alert("TODO");
  }

  private fillTitle(pb: Checklist | ChecklistGroup, promptType: string): boolean {
    let title = prompt(`Enter {promptType} title:`, pb.title);
    if (!title) {
      return false;
    }
    pb.title = title;
    return true;
  }
}
