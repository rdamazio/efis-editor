import { NestedTreeControl } from '@angular/cdk/tree';
import { Component, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTreeModule, MatTreeNestedDataSource } from '@angular/material/tree';
import { Observable, of } from 'rxjs';
import { ChecklistTreeNode } from './node/node';
import { ChecklistTreeNodeComponent } from './node/node.component';
import { ChecklistFile, ChecklistGroup } from '../../../../gen/ts/checklist';

// TODO: Replace with real data source
const TREE_DATA: ChecklistFile = {
  name: "N425RP",
  groups: [
    {
      title: 'Normal procedures',
      checklists: [
        { title: 'Before takeoff', items: [] },
        { title: 'After takeoff', items: [] },
        { title: 'Before landing', items: [] },
      ],
    },
    {
      title: 'Emergency procedures',
      checklists: [
        { title: 'Engine out at takeoff', items: [] },
        { title: 'Engine fire', items: [] },
        { title: 'Low voltage', items: [] },
        { title: 'A very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long name', items: [] },
      ],
    },
  ]
};

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

  @Input() file?: Observable<ChecklistFile> = of(TREE_DATA); 

  ngOnInit() {
    this.file?.subscribe(
      file => {
        let data = file.groups.map(ChecklistTreeComponent.groupToNode);
        data.push({
          title: "Add new checklist group",
          isAddNew: true,
        });
        this.dataSource.data = data;
        this.treeControl.dataNodes = data;
        this.treeControl.expandAll();
      }
    )
  }

  hasChild = (_: number, node: ChecklistTreeNode) => !!node.children && node.children.length > 0;

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
}
