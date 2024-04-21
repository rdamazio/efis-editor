import { NgFor } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { ChecklistFile } from '../../../../gen/ts/checklist';
import { ChecklistStorage } from '../../../model/storage/checklist-storage';

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
  @Output() fileSelected = new EventEmitter<string>();
  selectedFile = '';

  constructor(public store: ChecklistStorage) { }

  onFileSelected() {
    if (this.selectedFile === 'new') {
      this.onNewFile();
    } else if (this.selectedFile === 'upload') {
      this.onUploadFile();
    } else {
      this.loadFile();
    }
  }

  private loadFile() {
    this.fileSelected.emit(this.selectedFile);
  }

  onNewFile() {
    let name = prompt("Enter a name for the new file:");
    if (name) {
      // Save an empty file with that name.
      let file: ChecklistFile = {
        name: name,
        groups: [],
      };
      this.store.saveChecklistFile(file);
      this.selectedFile = name;
    } else {
      // TODO: Doesn't unselect the New File item if ESC is pressed (vs cancelling)
      this.selectedFile = '';
    }
    this.loadFile();
  }

  onUploadFile() {
    // TODO
  }
}
