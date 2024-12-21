import { Component, inject } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { lastValueFrom } from 'rxjs';

export interface GoogleDriveDisconnectDialogReturnData {
  deleteAllData: boolean;
}

@Component({
  selector: 'gdrive-disconnect-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    ReactiveFormsModule,
  ],
  templateUrl: './gdrive-disconnect-dialog.component.html',
  styleUrl: './gdrive-disconnect-dialog.component.scss',
})
export class GoogleDriveDisconnectDialogComponent {
  private readonly _formBuilder = inject(FormBuilder);

  readonly formData = this._formBuilder.group({
    deleteAllData: false,
  });

  getReturnData(): GoogleDriveDisconnectDialogReturnData {
    return {
      deleteAllData: this.formData.value.deleteAllData!.valueOf(),
    };
  }

  public static async confirmDisconnection(
    dialog: MatDialog,
  ): Promise<GoogleDriveDisconnectDialogReturnData | undefined> {
    const dialogRef: MatDialogRef<GoogleDriveDisconnectDialogComponent, GoogleDriveDisconnectDialogReturnData> =
      dialog.open(GoogleDriveDisconnectDialogComponent, {
        maxWidth: '800px',
      });

    return lastValueFrom(dialogRef.afterClosed(), { defaultValue: undefined });
  }
}
