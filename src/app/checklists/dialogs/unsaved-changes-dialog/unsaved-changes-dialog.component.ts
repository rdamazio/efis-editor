import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { filter, lastValueFrom, Observable } from 'rxjs';

@Component({
  selector: 'checklist-unsaved-changes-dialog',
  imports: [MatButtonModule, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MatIconModule],
  templateUrl: './unsaved-changes-dialog.component.html',
  styleUrl: './unsaved-changes-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class UnsavedChangesDialogComponent {
  /**
   * Shows the unsaved changes confirmation dialog and waits for confirmation.
   *
   * @param dialog MatDialog instance to use
   * @returns a promise that resolves truthy if discarding changes is confirmed, or false otherwise.
   */
  public static async confirmDiscard(dialog: MatDialog): Promise<boolean> {
    const dialogRef = dialog.open(UnsavedChangesDialogComponent);

    const afterClosed$ = dialogRef.afterClosed() as Observable<boolean | undefined>;
    return lastValueFrom(afterClosed$.pipe(filter((x?: boolean) => x !== undefined)), { defaultValue: false });
  }
}
