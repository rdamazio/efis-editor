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
import { lastValueFrom, startWith } from 'rxjs';

export interface TitleDialogData {
  promptType: string;
  initialTitle?: string;
}

@Component({
  selector: 'checklist-title-dialog',
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
  templateUrl: './title-dialog.component.html',
  styleUrl: './title-dialog.component.scss',
})
export class TitleDialogComponent {
  public title = '';

  constructor(@Inject(MAT_DIALOG_DATA) public data: TitleDialogData) {
    this.title = data.initialTitle ?? '';
  }

  /**
   * Shows the title editing dialog and waits for it.
   *
   * @param data details to show on the dialog
   * @param dialog MatDialog instance to use
   * @returns a promise that resolves to the title if confirmed, or undefined otherwise.
   */
  public static async promptForTitle(data: TitleDialogData, dialog: MatDialog): Promise<string | undefined> {
    const dialogRef = dialog.open(TitleDialogComponent, { data: data });

    return lastValueFrom(dialogRef.afterClosed().pipe(startWith(undefined)));
  }
}
