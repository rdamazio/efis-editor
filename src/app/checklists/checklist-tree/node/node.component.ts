import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, input, output, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconButtonSizesModule } from 'mat-icon-button-sizes';
import { ChecklistGroup_Category } from '../../../../../gen/ts/checklist';
import { DeleteDialogComponent } from '../../dialogs/delete-dialog/delete-dialog.component';
import { ChecklistTreeNode } from './node';

@Component({
  selector: 'checklist-tree-node',
  imports: [
    CdkDragHandle,
    MatButtonModule,
    MatDialogModule,
    MatIconButtonSizesModule,
    MatIconModule,
    MatTooltipModule,
    MatSelect,
    MatOption,
  ],
  templateUrl: './node.component.html',
  styleUrl: './node.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ChecklistTreeNodeComponent {
  readonly node = input.required<ChecklistTreeNode>();
  readonly disableButtonHover = input(false);
  readonly nodeRename = output<ChecklistTreeNode>();
  readonly nodeDelete = output<ChecklistTreeNode>();
  readonly dragHandle = viewChild(CdkDragHandle);

  hideButtons = true;

  protected readonly _groupCategories = new Map<ChecklistGroup_Category, string>([
    [ChecklistGroup_Category.normal, '🄽ormal'],
    [ChecklistGroup_Category.abnormal, '🄰bnormal'],
    [ChecklistGroup_Category.emergency, '🄴mergency'],
  ]);

  constructor(private readonly _dialog: MatDialog) {}

  get checklistGroupCategory(): ChecklistGroup_Category {
    return this.node().group!.category;
  }
  set checklistGroupCategory(value: ChecklistGroup_Category) {
    this.node().group!.category = value;
  }

  async onDelete() {
    const isChecklist = Boolean(this.node().checklist);
    const nodeTitle = this.node().title;
    const confirmed = await DeleteDialogComponent.confirmDeletion(
      {
        entityType: isChecklist ? 'checklist' : 'group',
        entityDescription: isChecklist
          ? `checklist ${nodeTitle}`
          : `checklist group ${nodeTitle} and all checklists within`,
      },
      this._dialog,
    );

    if (confirmed) {
      this.nodeDelete.emit(this.node());
    }
  }
}
