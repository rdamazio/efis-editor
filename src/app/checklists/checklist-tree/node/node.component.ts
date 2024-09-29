import { NgIf } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';
import { MatIconButtonSizesModule } from 'mat-icon-button-sizes';
import { ChecklistGroup_Category } from '../../../../../gen/ts/checklist';
import { ChecklistTreeNode } from './node';

@Component({
  selector: 'checklist-tree-node',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconButtonSizesModule,
    MatIconModule,
    MatTooltipModule,
    NgIf,
    MatSelect,
    MatOption,
    SweetAlert2Module,
  ],
  templateUrl: './node.component.html',
  styleUrl: './node.component.scss',
})
export class ChecklistTreeNodeComponent {
  @Input() node!: ChecklistTreeNode;
  @Output() nodeRename = new EventEmitter<ChecklistTreeNode>();
  @Output() nodeDelete = new EventEmitter<ChecklistTreeNode>();

  hideButtons = true;

  protected readonly GROUP_CATEGORIES = new Map<ChecklistGroup_Category, string>([
    [ChecklistGroup_Category.normal, '🄽ormal'],
    [ChecklistGroup_Category.abnormal, '🄰bnormal'],
    [ChecklistGroup_Category.emergency, '🄴mergency'],
  ]);

  get checklistGroupCategory(): ChecklistGroup_Category {
    return this.node.group!.category;
  }
  set checklistGroupCategory(value: ChecklistGroup_Category) {
    this.node.group!.category = value;
  }
}
