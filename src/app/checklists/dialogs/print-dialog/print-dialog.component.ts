import { Component } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { lastValueFrom, Observable } from 'rxjs';
import { PdfWriterOptions } from '../../../../model/formats/pdf-writer';

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
    MatInputModule,
    MatRadioModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  templateUrl: './print-dialog.component.html',
  styleUrl: './print-dialog.component.scss',
})
export class PrintDialogComponent {
  options: PdfWriterOptions = {
    format: 'letter',
    orientation: 'portrait',
    outputCoverPage: true,
    outputCoverPageFooter: false,
    outputPageNumbers: true,
  };

  public static async show(dialog: MatDialog): Promise<PdfWriterOptions | undefined> {
    const pdfDialog = dialog.open(PrintDialogComponent, {
      hasBackdrop: true,
      closeOnNavigation: true,
      enterAnimationDuration: 200,
      exitAnimationDuration: 200,
      role: 'dialog',
      ariaModal: true,
    });
    const afterClosed$ = pdfDialog.afterClosed() as Observable<PdfWriterOptions | undefined>;
    return lastValueFrom(afterClosed$, { defaultValue: undefined });
  }
}
