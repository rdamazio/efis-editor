import { NgIf } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatIconButtonSizesModule } from 'mat-icon-button-sizes';
import { ChecklistTreeNode } from './node';

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
