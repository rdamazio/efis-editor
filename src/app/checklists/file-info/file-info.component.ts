import { Component, Inject } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ChecklistFileMetadata } from '../../../../gen/ts/checklist';

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
    ReactiveFormsModule,
  ],
  templateUrl: './file-info.component.html',
  styleUrl: './file-info.component.scss'
})
export class ChecklistFileInfoComponent {
  constructor(
    public dialogRef: MatDialogRef<ChecklistFileInfoComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ChecklistFileMetadata,
  ) { }
}