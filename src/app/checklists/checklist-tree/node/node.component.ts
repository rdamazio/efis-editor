import { NgIf } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatIconButtonSizesModule } from 'mat-icon-button-sizes';
import { ChecklistTreeNode } from './node';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ChecklistGroup_Category } from '../../../../../gen/ts/checklist';
import { MatOption, MatSelect } from '@angular/material/select';

interface CategorySelector {
  viewValue: string;
  style: string;
}

@Component({
  selector: 'checklist-tree-node',
  standalone: true,
  imports: [MatButtonModule, MatIconButtonSizesModule, MatIconModule, MatTooltipModule, NgIf, MatSelect, MatOption],
  templateUrl: './node.component.html',
  styleUrl: './node.component.scss',
})
export class ChecklistTreeNodeComponent {
  @Input() node!: ChecklistTreeNode;
  @Output() nodeRename = new EventEmitter<ChecklistTreeNode>();
  @Output() nodeDelete = new EventEmitter<ChecklistTreeNode>();

  hideButtons = true;

  protected readonly checklistGroupCategories = new Map<ChecklistGroup_Category, CategorySelector>([
    [ChecklistGroup_Category.normal, { viewValue: '🄽', style: 'color: white !important' }],
    [ChecklistGroup_Category.abnormal, { viewValue: '🄰', style: 'color: yellow !important' }],
    [ChecklistGroup_Category.emergency, { viewValue: '🄴', style: 'color: red !important' }],
  ]);

  get checklistGroupCategory(): ChecklistGroup_Category {
    return this.node.group!.category;
  }
  set checklistGroupCategory(value: ChecklistGroup_Category) {
    this.node.group!.category = value;
  }
}
