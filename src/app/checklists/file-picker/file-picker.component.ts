import { NgFor } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';

@Component({
  selector: 'checklist-file-picker',
  standalone: true,
  imports: [
    MatIconModule,
    MatSelectModule,
    NgFor,
  ],
  templateUrl: './file-picker.component.html',
  styleUrl: './file-picker.component.scss'
})
export class ChecklistFilePickerComponent {
  @Input() fileNames?: string[];
  @Input() selectedFile = '';
  @Output() fileSelected = new EventEmitter<string>();
  @Output() cancel = new EventEmitter<boolean>();
}
