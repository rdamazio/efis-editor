import { NgOptimizedImage } from '@angular/common';
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { filter, lastValueFrom, Observable } from 'rxjs';

@Component({
  selector: 'gdrive-connect-dialog',
  imports: [MatButtonModule, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, NgOptimizedImage],
  templateUrl: './gdrive-connect-dialog.component.html',
  styleUrl: './gdrive-connect-dialog.component.scss',
})
export class GoogleDriveConnectDialogComponent {
  public static async confirmConnection(dialog: MatDialog): Promise<boolean> {
    const dialogRef = dialog.open(GoogleDriveConnectDialogComponent, { maxWidth: '800px' });

    const afterClosed$ = dialogRef.afterClosed() as Observable<boolean | undefined>;
    return lastValueFrom(afterClosed$.pipe(filter((x?: boolean) => x !== undefined)), { defaultValue: false });
  }
}
