import { NestedTreeControl } from '@angular/cdk/tree';
import { Component, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTreeModule, MatTreeNestedDataSource } from '@angular/material/tree';
import { ChecklistTreeNode } from './node/node';
import { ChecklistTreeNodeComponent } from './node/node.component';
import { ChecklistFile, ChecklistGroup } from '../../../../gen/ts/checklist';

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
  treeControl = new NestedTreeControl<ChecklistTreeNode>(node => node.children);
  dataSource = new MatTreeNestedDataSource<ChecklistTreeNode>();
  _file?: ChecklistFile;

  @Input()
  get file() : ChecklistFile | undefined { return this._file; }
  set file(file: ChecklistFile | undefined) {
    this._file = file;

    let data : ChecklistTreeNode[] = [];
    if (file) {
      data = file.groups.map(ChecklistTreeComponent.groupToNode);
      data.push({
        title: "Add new checklist group",
        isAddNew: true,
      });
    }

    this.dataSource.data = data;
    this.treeControl.dataNodes = data;
    this.treeControl.expandAll();
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
      isAddNew: true,
    });
    return node;
  }

  hasChild = (_: number, node: ChecklistTreeNode) => !!node.children && node.children.length > 0;
}
