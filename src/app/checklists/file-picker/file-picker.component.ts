import { NgFor } from '@angular/common';
import { Component, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { ChecklistFile } from '../../../../gen/ts/checklist';

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
  @Output() selectedFile = '';

  // TODO: replace with real data.
  fileList: ChecklistFile[] = [
    {
      name: "N425RP",
      groups: [],
    },
  ];

  onFileSelected() {
    if (this.selectedFile === 'new') {
        this.onNewFile();
        return;
    } else if (this.selectedFile === 'upload') {
        this.onUploadFile();
        return;
    } else {
      // TODO
    }
  }

  onNewFile() {
    // TODO
    this.selectedFile = '';
  }

  onUploadFile() {
    // TODO
  }
}
