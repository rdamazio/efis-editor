import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { filter, lastValueFrom, Observable, startWith } from 'rxjs';

export interface DeleteDialogData {
  entityType: string;
  entityDescription: string;
}

@Component({
  selector: 'app-delete-dialog',
  imports: [MatButtonModule, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MatIconModule],
  templateUrl: './delete-dialog.component.html',
  styleUrl: './delete-dialog.component.scss',
})
export class DeleteDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: DeleteDialogData) {}

  /**
   * Shows the deletion confirmation dialog and waits for confirmation.
   *
   * @param data details to show on the dialog
   * @param dialog MatDialog instance to use
   * @returns a promise that resolves truthy if deletion is confirmed, or false otherwise.
   */
  public static async confirmDeletion(data: DeleteDialogData, dialog: MatDialog): Promise<boolean> {
    const dialogRef = dialog.open(DeleteDialogComponent, { data: data });

    // If it completes without emitting anything, we return false.
    const afterClosed = dialogRef.afterClosed() as Observable<boolean | undefined>;
    return lastValueFrom(
      afterClosed.pipe(
        startWith(false),
        filter((x) => x !== undefined),
      ),
    );
  }
}
