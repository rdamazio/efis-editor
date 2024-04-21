import { NgIf } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ChecklistTreeNode } from './node';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatIconButtonSizesModule } from 'mat-icon-button-sizes';

@Component({
  selector: 'checklist-tree-node',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconButtonSizesModule,
    MatIconModule,
    NgIf,
  ],
  templateUrl: './node.component.html',
  styleUrl: './node.component.scss'
})
export class ChecklistTreeNodeComponent {
  @Input() node!: ChecklistTreeNode;
  @Output() nodeRename = new EventEmitter<ChecklistTreeNode>;
  @Output() nodeDelete = new EventEmitter<ChecklistTreeNode>;

  hideButtons = true;
}
