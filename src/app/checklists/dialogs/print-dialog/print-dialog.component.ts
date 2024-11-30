import { Component } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
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
}
