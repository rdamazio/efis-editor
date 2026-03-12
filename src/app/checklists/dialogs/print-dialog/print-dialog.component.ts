import { Component, inject, OnInit } from '@angular/core';
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
import { MatDividerModule } from '@angular/material/divider';
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
    MatDividerModule,
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
export class PrintDialogComponent implements OnInit {
  public options = inject(MAT_DIALOG_DATA) as PdfWriterOptions;

  ngOnInit(): void {
    this.onColumnsChange();
  }

  onColumnsChange(): void {
    if (this.options.columns === 1 && this.options.checklistStart === 'column') {
      this.options.checklistStart = 'page';
    }
  }

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
