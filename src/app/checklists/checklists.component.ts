import { Component, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { saveAs } from 'file-saver';
import { Checklist, ChecklistFile, ChecklistFileMetadata } from '../../../gen/ts/checklist';
import { AceWriter } from '../../model/formats/ace-writer';
import { ChecklistStorage } from '../../model/storage/checklist-storage';
import { ChecklistTreeComponent } from './checklist-tree/checklist-tree.component';
import { ChecklistCommandBarComponent } from './command-bar/command-bar.component';
import { ChecklistFileInfoComponent } from './file-info/file-info.component';
import { ChecklistFilePickerComponent } from './file-picker/file-picker.component';
import { ChecklistFileUploadComponent } from './file-upload/file-upload.component';
import { ChecklistItemsComponent } from './items-list/items-list.component';
import { JsonFormat } from '../../model/formats/json-format';
import { FormatError } from '../../model/formats/error';
import { AceFormat } from '../../model/formats/ace-format';
import { GrtFormat } from '../../model/formats/grt-format';

@Component({
  selector: 'app-checklists',
  standalone: true,
  imports: [
    ChecklistCommandBarComponent,
    ChecklistFilePickerComponent,
    ChecklistFileInfoComponent,
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

  constructor(public store: ChecklistStorage, private _dialog: MatDialog) { }

  onNewFile() {
    this.showFilePicker = false;

    const name = prompt("Enter a name for the new file:");
    if (!name) {
      return;
    }

    // Save an empty file with that name.
    const file: ChecklistFile = {
      groups: [],
      metadata: ChecklistFileMetadata.create({
        name: name,
      }),
    };
    this.store.saveChecklistFile(file);
    this._displayFile(file);
  }

  onOpenFile() {
    this.showFilePicker = !this.showFilePicker;
    this.showFileUpload = false;
  }

  onOpenFileCancel() {
    this.showFilePicker = false;
  }

  onUploadFile() {
    this.showFilePicker = false;
    this.showFileUpload = !this.showFileUpload;
  }

  onUploadFileCancel() {
    this.showFileUpload = false;
  }

  onFileUploaded(file: ChecklistFile) {
    this.showFileUpload = false;

    this.store.saveChecklistFile(file);
    this._displayFile(file);
  }

  async onDownloadFile(formatId: string) {
    this.showFilePicker = false;
    this.showFileUpload = false;

    if (!this.selectedFile) return;

    let file: File;
    if (formatId === 'ace') {
      file = await AceFormat.fromProto(this.selectedFile);
    } else if (formatId === 'json') {
      file = await JsonFormat.fromProto(this.selectedFile);
    } else if (formatId === 'grt') {
      file = await GrtFormat.fromProto(this.selectedFile);
    } else {
      throw new FormatError(`Unknown format "${formatId}"`);
    }
    saveAs(file, file.name);
  }

  onDeleteFile() {
    this.showFilePicker = false;
    this.showFileUpload = false;

    if (!this.selectedFile) return;

    // TODO: Look into using a framework that makes nicer dialogs, like ng-bootstrap, sweetalert, sweetalert2 or ng-vibe
    if (!confirm(`Are you sure you'd like to delete checklist file "${this.selectedFile.metadata!.name}??`)) return;

    this.store.deleteChecklistFile(this.selectedFile.metadata!.name);
    this._displayFile(undefined);
  }

  onFileInfo() {
    this.showFilePicker = false;
    this.showFileUpload = false;

    if (!this.selectedFile) return;

    const dialogRef = this._dialog.open(ChecklistFileInfoComponent, {
      data: ChecklistFileMetadata.clone(this.selectedFile.metadata!),
      hasBackdrop: true,
      closeOnNavigation: true,
      enterAnimationDuration: 200,
      exitAnimationDuration: 200,
      role: 'dialog',
      ariaModal: true,
    });

    dialogRef.afterClosed().subscribe((updatedData: ChecklistFileMetadata) => {
      if (!updatedData || !this.selectedFile) return;

      const oldName = this.selectedFile.metadata!.name;
      const newName = updatedData.name;
      this.selectedFile.metadata = updatedData;
      this.store.saveChecklistFile(this.selectedFile);
      if (oldName !== newName) {
        // File was renamed, delete old one from storage.
        this.store.deleteChecklistFile(oldName);
        this.filePicker!.selectedFile = newName;
      }
    });
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
    if (file?.metadata) {
      // Make the file selected the next time the picker gets displayed
      this.filePicker!.selectedFile = file.metadata.name;
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
