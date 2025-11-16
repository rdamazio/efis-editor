import { Component, Inject } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { lastValueFrom, Observable } from 'rxjs';
import { Checklist, Checklist_CompletionAction } from '../../../../../gen/ts/checklist';

@Component({
  selector: 'checklist-info-dialog',
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
  templateUrl: './checklist-info.html',
  styleUrl: './checklist-info.scss',
})
export class ChecklistInfoComponent {
  protected readonly _completionActions = Checklist_CompletionAction;

  constructor(@Inject(MAT_DIALOG_DATA) public data: Checklist) {}

  public static async showChecklistInfo(checklist: Checklist, dialog: MatDialog): Promise<Checklist | undefined> {
    const dialogRef = dialog.open(ChecklistInfoComponent, {
      data: Checklist.clone(checklist),
      hasBackdrop: true,
      closeOnNavigation: true,
      enterAnimationDuration: 200,
      exitAnimationDuration: 200,
      role: 'dialog',
      ariaModal: true,
    });

    const afterClosed$ = dialogRef.afterClosed() as Observable<Checklist | undefined>;
    return lastValueFrom(afterClosed$, { defaultValue: undefined });
  }
}
