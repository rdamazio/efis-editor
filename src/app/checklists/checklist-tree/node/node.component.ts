import { NgIf } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatIconButtonSizesModule } from 'mat-icon-button-sizes';
import { ChecklistTreeNode } from './node';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ChecklistGroup_Category } from '../../../../../gen/ts/checklist';

@Component({
  selector: 'checklist-tree-node',
  standalone: true,
  imports: [MatButtonModule, MatIconButtonSizesModule, MatIconModule, MatTooltipModule, NgIf],
  templateUrl: './node.component.html',
  styleUrl: './node.component.scss',
})
export class ChecklistTreeNodeComponent {
  @Input() node!: ChecklistTreeNode;
  @Output() nodeRename = new EventEmitter<ChecklistTreeNode>();
  @Output() nodeDelete = new EventEmitter<ChecklistTreeNode>();

  hideButtons = true;
  protected readonly ChecklistGroup_Category = ChecklistGroup_Category;
}
