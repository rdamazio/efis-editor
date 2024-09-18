import { Component, Inject } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ChecklistFileMetadata, ChecklistGroup } from '../../../../gen/ts/checklist';

export interface FileInfoDialogData {
  metadata: ChecklistFileMetadata;
  allGroups: ChecklistGroup[];
}

@Component({
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  templateUrl: './file-info.component.html',
  styleUrl: './file-info.component.scss',
})
export class ChecklistFileInfoComponent {
  constructor(
    public dialogRef: MatDialogRef<ChecklistFileInfoComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FileInfoDialogData,
  ) {}

  get defaultChecklist(): string {
    return `${this.data.metadata.defaultGroupIndex}.${this.data.metadata.defaultChecklistIndex}`;
  }
  set defaultChecklist(val: string) {
    const dotIdx = val.indexOf('.');
    if (dotIdx === -1) {
      throw new Error(`Invalid checklist value "${val}"`);
    }

    this.data.metadata.defaultGroupIndex = parseInt(val.slice(0, dotIdx));
    this.data.metadata.defaultChecklistIndex = parseInt(val.slice(dotIdx + 1));
  }
}
