import { Component, ViewChild } from '@angular/core';
import { saveAs } from 'file-saver';
import { Checklist, ChecklistFile } from '../../../gen/ts/checklist';
import { AceWriter } from '../../model/formats/ace-writer';
import { ChecklistStorage } from '../../model/storage/checklist-storage';
import { ChecklistTreeComponent } from './checklist-tree/checklist-tree.component';
import { ChecklistCommandBarComponent } from './command-bar/command-bar.component';
import { ChecklistFilePickerComponent } from './file-picker/file-picker.component';
import { ChecklistFileUploadComponent } from './file-upload/file-upload.component';
import { ChecklistItemsComponent } from './items-list/items-list.component';

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
  selectedFile?: ChecklistFile;
  @ViewChild("tree") tree?: ChecklistTreeComponent;
  @ViewChild("filePicker") filePicker?: ChecklistFilePickerComponent;

  showFilePicker: boolean = false;
  showFileUpload: boolean = false;

  constructor(public store: ChecklistStorage) { }

  onNewFile() {
    this.showFilePicker = false;

    const name = prompt("Enter a name for the new file:");
    if (!name) {
      return;
    }

    // Save an empty file with that name.
    const file: ChecklistFile = {
      name: name,
      groups: [],
      metadata: undefined,
    };
    this.store.saveChecklistFile(file);
    this._displayFile(file);
  }

  onOpenFile() {
    this.showFilePicker = true;
    this.showFileUpload = false;
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

  async onDownloadFile() {
    this.showFilePicker = false;
    this.showFileUpload = false;

    if (!this.selectedFile) return;

    const contents = await new AceWriter().write(this.selectedFile);
    saveAs(contents, this.selectedFile.name + '.ace');
  }

  onDeleteFile() {
    this.showFilePicker = false;
    this.showFileUpload = false;

    if (!this.selectedFile) return;

    // TODO: Look into using a framework that makes nicer dialogs, like ng-bootstrap, sweetalert, sweetalert2 or ng-vibe
    if (!confirm(`Are you sure you'd like to delete checklist file "${this.selectedFile.name}??`)) return;

    this.store.deleteChecklistFile(this.selectedFile.name);
    this._displayFile(undefined);
  }

  onFileSelected(id: string) {
    this.showFilePicker = false;

    let file: ChecklistFile | undefined;
    if (id) {
      const loadedFile = this.store.getChecklistFile(id);
      if (loadedFile) {
        file = loadedFile;
      }
    }
    this._displayFile(file);
  }

  private _displayFile(file?: ChecklistFile) {
    this.selectedFile = file;
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
    if (this.selectedFile) {
      this.store.saveChecklistFile(this.selectedFile);
    }
  }
}
