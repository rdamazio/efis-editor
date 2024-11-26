import { NgFor } from '@angular/common';
import { Component, input, model, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';

@Component({
  selector: 'checklist-file-picker',
  imports: [MatIconModule, MatSelectModule, NgFor],
  templateUrl: './file-picker.component.html',
  styleUrl: './file-picker.component.scss',
})
export class ChecklistFilePickerComponent {
  readonly fileNames = input.required<string[]>();
  readonly selectedFile = model<string>('');
  readonly fileSelected = output<string>();
}
