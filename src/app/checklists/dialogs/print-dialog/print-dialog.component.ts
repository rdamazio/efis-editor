import { Component, inject } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { lastValueFrom, Observable } from 'rxjs';
import { PdfWriterOptions } from '../../../../model/formats/pdf-writer';
import { PreferenceStorage } from '../../../../model/storage/preference-storage';

@Component({
  selector: 'checklist-print-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatFormFieldModule,
    MatGridListModule,
    MatInputModule,
    MatRadioModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  templateUrl: './print-dialog.component.html',
  styleUrl: './print-dialog.component.scss',
})
export class PrintDialogComponent {
  public options = inject(MAT_DIALOG_DATA) as PdfWriterOptions;

  public static async show(dialog: MatDialog, prefs: PreferenceStorage): Promise<PdfWriterOptions | undefined> {
    const data = await prefs.getPrintOptions();
    const pdfDialog = dialog.open(PrintDialogComponent, {
      data: data,
      hasBackdrop: true,
      closeOnNavigation: true,
      enterAnimationDuration: 200,
      exitAnimationDuration: 200,
      role: 'dialog',
      ariaModal: true,
    });
    const afterClosed$ = pdfDialog.afterClosed() as Observable<PdfWriterOptions | undefined>;
    return lastValueFrom(afterClosed$, { defaultValue: undefined }).then(async (opts?: PdfWriterOptions) => {
      if (opts) {
        await prefs.setPrintOptions(opts);
      }
      return opts;
    });
  }
}
