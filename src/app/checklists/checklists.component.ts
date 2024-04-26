import { Component, ViewChild } from '@angular/core';
import { Checklist, ChecklistFile } from '../../../gen/ts/checklist';
import { ChecklistStorage } from '../../model/storage/checklist-storage';
import { ChecklistTreeComponent } from './checklist-tree/checklist-tree.component';
import { ChecklistCommandBarComponent } from './command-bar/command-bar.component';
import { ChecklistFilePickerComponent } from './file-picker/file-picker.component';
import { ChecklistItemsComponent } from './items-list/items-list.component';
import { ChecklistFileUploadComponent } from './file-upload/file-upload.component';

@Component({
  selector: 'app-checklists',
  standalone: true,
  imports: [
    ChecklistCommandBarComponent,
    ChecklistFilePickerComponent,
    ChecklistFileUploadComponent,
    ChecklistItemsComponent,
    ChecklistTreeComponent
  ],
  templateUrl: './checklists.component.html',
  styleUrl: './checklists.component.scss'
})
export class ChecklistsComponent {
  private _selectedFile?: ChecklistFile;
  @ViewChild("tree") tree?: ChecklistTreeComponent;
  @ViewChild("filePicker") filePicker?: ChecklistFilePickerComponent;

  showFilePicker: boolean = false;
  showFileUpload: boolean = true;

  constructor(public store: ChecklistStorage) { }

  onNewFile() {
    this.showFilePicker = false;

    let name = prompt("Enter a name for the new file:");
    if (!name) {
      return;
    }

    // Save an empty file with that name.
    let file: ChecklistFile = {
      name: name,
      groups: [],
    };
    this.store.saveChecklistFile(file);
    this._displayFile(file);
  }

  onOpenFile() {
    this.showFilePicker = true;
  }

  onOpenFileCancel() {
    this.showFilePicker = false;
  }

  onUploadFile() {
    this.showFilePicker = false;
    this.showFileUpload = true;
  }

  onUploadFileCancel() {
    this.showFileUpload = false;
  }

  onFileUploaded(file: ChecklistFile) {
    this.showFileUpload = false;
    
    this.store.saveChecklistFile(file);
    this._displayFile(file);
  }

  onDownloadFile() {
    this.showFilePicker = false;

    window.alert('TODO');
  }

  onFileSelected(id: string) {
    this.showFilePicker = false;

    let file: ChecklistFile | undefined;
    if (id) {
      let loadedFile = this.store.getChecklistFile(id);
      if (loadedFile) {
        file = loadedFile;
      }
    }
    this._displayFile(file);
  }

  private _displayFile(file?: ChecklistFile) {
    this._selectedFile = file;
    this.tree!.file = file;
    if (file) {
      // Make the file selected the next time the picker gets displayed
      this.filePicker!.selectedFile = file.name;
    }

    // TODO: Add filename to topbar, add rename pencil there
  }

  onStructureChanged(file: ChecklistFile) {
    this.store.saveChecklistFile(file);
  }

  onChecklistChanged(checklist: Checklist) {
    if (this._selectedFile) {
      this.store.saveChecklistFile(this._selectedFile);
    }
  }
}
