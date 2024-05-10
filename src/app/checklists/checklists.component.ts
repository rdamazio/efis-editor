import { AsyncPipe } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { saveAs } from 'file-saver';
import { Checklist, ChecklistFile, ChecklistFileMetadata } from '../../../gen/ts/checklist';
import { AceFormat } from '../../model/formats/ace-format';
import { DynonFormat } from '../../model/formats/dynon-format';
import { FormatError } from '../../model/formats/error';
import { GrtFormat } from '../../model/formats/grt-format';
import { JsonFormat } from '../../model/formats/json-format';
import { ChecklistStorage } from '../../model/storage/checklist-storage';
import { ChecklistTreeComponent } from './checklist-tree/checklist-tree.component';
import { ChecklistCommandBarComponent } from './command-bar/command-bar.component';
import { ChecklistFileInfoComponent } from './file-info/file-info.component';
import { ChecklistFilePickerComponent } from './file-picker/file-picker.component';
import { ChecklistFileUploadComponent } from './file-upload/file-upload.component';
import { ChecklistItemsComponent } from './items-list/items-list.component';

@Component({
  selector: 'app-checklists',
  standalone: true,
  imports: [
    AsyncPipe,
    ChecklistCommandBarComponent,
    ChecklistFilePickerComponent,
    ChecklistFileInfoComponent,
    ChecklistFileUploadComponent,
    ChecklistItemsComponent,
    ChecklistTreeComponent
  ],
  templateUrl: './checklists.component.html',
  styleUrl: './checklists.component.scss',
})
export class ChecklistsComponent {
  selectedFile?: ChecklistFile;
  @ViewChild("tree") tree?: ChecklistTreeComponent;
  @ViewChild("filePicker") filePicker?: ChecklistFilePickerComponent;

  showFilePicker: boolean = false;
  showFileUpload: boolean = false;

  constructor(public store: ChecklistStorage, private _dialog: MatDialog, private _route: ActivatedRoute) { }

  ngOnInit() {
    this._route.fragment.subscribe(async (fragment) => {
      // We use fragment-based navigation because of the routing limitations associated with GH Pages.
      // (yes, I could make 404.html point to index.html, but that's just horrible)
      await this._onFragmentChange(fragment);
    });
  }

  private async _onFragmentChange(fragment: string | null) {
    const parsed = this._parseFragment(fragment);
    const fileName = parsed.fileName;

    await this.onFileSelected(fileName);

    if (fileName) {
      if (!this.selectedFile) {
        console.log(`Failed to load file ${fileName}`);
        return;
      }

      let checklist: Checklist | undefined;
      if (parsed.checklistIdx !== undefined && parsed.groupIdx !== undefined) {
        if (this.selectedFile.groups.length <= parsed.groupIdx) {
          console.log(`File ${fileName} does not have group ${parsed.groupIdx}`);
          return;
        }

        const group = this.selectedFile.groups[parsed.groupIdx];
        if (group.checklists.length <= parsed.checklistIdx) {
          console.log(`Group ${parsed.groupIdx} in file ${fileName} has no checklist ${parsed.checklistIdx}`);
          return;
        }

        checklist = group.checklists[parsed.checklistIdx];
      }
      this.tree!.selectedChecklist = checklist;
    }
  }

  private _parseFragment(fragment: string | null): { fileName?: string, groupIdx?: number, checklistIdx?: number } {
    if (!fragment) return {};

    // Two possible fragment formats:
    // #checklistname
    // #checklistname/groupIdx/checklistIdx

    const checklistSepIdx = fragment.lastIndexOf('/');
    if (checklistSepIdx === -1) {
      return { fileName: fragment };
    }

    const checklistIdxStr = fragment.substring(checklistSepIdx + 1);
    const checklistIdx = parseInt(checklistIdxStr);
    if (isNaN(checklistIdx)) {
      return { fileName: fragment };
    }
    const groupSepIdx = fragment.lastIndexOf('/', checklistSepIdx - 1);
    const groupIdxStr = fragment.substring(groupSepIdx + 1, checklistSepIdx);
    const groupIdx = parseInt(groupIdxStr);
    if (isNaN(groupIdx)) {
      return { fileName: fragment };
    }

    const fileName = fragment.slice(0, groupSepIdx);
    return { fileName, groupIdx, checklistIdx };
  }

  onNewFile() {
    this.showFilePicker = false;
    this.showFileUpload = false;

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

  onUploadFile() {
    this.showFilePicker = false;
    this.showFileUpload = !this.showFileUpload;
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
    } else if (formatId === 'afs') {
      file = await DynonFormat.fromProto(this.selectedFile, 'CHKLST.AFD');
    } else if (formatId === 'dynon') {
      file = await DynonFormat.fromProto(this.selectedFile, 'checklist.txt');
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
    if (!confirm(`Are you sure you'd like to delete checklist file "${this.selectedFile.metadata!.name}"??`)) return;

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

  async onFileSelected(id?: string) {
    this.showFilePicker = false;

    let file: ChecklistFile | undefined;
    if (id) {
      const loadedFile = await this.store.getChecklistFile(id);
      if (loadedFile) {
        file = loadedFile;
      }
    }
    this._displayFile(file);
  }

  private _displayFile(file?: ChecklistFile) {
    this.selectedFile = file;
    if (this.tree) {
      this.tree.file = file;
    }
    if (file?.metadata) {
      // Make the file selected the next time the picker gets displayed
      this.filePicker!.selectedFile = file.metadata.name;
    }

    // TODO: Add filename to topbar, add rename pencil there
  }

  onFileChanged(file: ChecklistFile) {
    this.store.saveChecklistFile(file);
  }

  onChecklistChanged(checklist: Checklist) {
    if (this.selectedFile) {
      this.store.saveChecklistFile(this.selectedFile);
    }
  }
}
