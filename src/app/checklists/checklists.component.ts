import { AsyncPipe } from '@angular/common';
import { afterNextRender, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { HotkeysDirective, HotkeysService } from '@ngneat/hotkeys';
import { saveAs } from 'file-saver';
import { Checklist, ChecklistFile, ChecklistFileMetadata, ChecklistItem_Type } from '../../../gen/ts/checklist';
import { AceFormat } from '../../model/formats/ace-format';
import { DynonFormat } from '../../model/formats/dynon-format';
import { FormatError } from '../../model/formats/error';
import { GrtFormat } from '../../model/formats/grt-format';
import { JsonFormat } from '../../model/formats/json-format';
import { ChecklistStorage } from '../../model/storage/checklist-storage';
import { ChecklistTreeBarComponent } from './checklist-tree/bar/bar.component';
import { ChecklistTreeComponent } from './checklist-tree/checklist-tree.component';
import { ChecklistCommandBarComponent } from './command-bar/command-bar.component';
import { ChecklistFileInfoComponent, FileInfoDialogData } from './file-info/file-info.component';
import { ChecklistFilePickerComponent } from './file-picker/file-picker.component';
import { ChecklistFileUploadComponent } from './file-upload/file-upload.component';
import { HelpComponent } from './hotkeys/help/help.component';
import { ChecklistItemsComponent } from './items-list/items-list.component';

interface ParsedFragment {
  fileName?: string;
  groupIdx?: number;
  checklistIdx?: number;
}

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
    ChecklistTreeBarComponent,
    ChecklistTreeComponent,
    HotkeysDirective,
    MatDialogModule,
  ],
  templateUrl: './checklists.component.html',
  styleUrl: './checklists.component.scss',
})
export class ChecklistsComponent implements OnInit, OnDestroy {
  selectedFile?: ChecklistFile;
  @ViewChild('tree') tree?: ChecklistTreeComponent;
  @ViewChild('items') items?: ChecklistItemsComponent;
  @ViewChild('filePicker') filePicker?: ChecklistFilePickerComponent;

  showFilePicker = false;
  showFileUpload = false;

  constructor(
    public store: ChecklistStorage,
    private _dialog: MatDialog,
    private _snackBar: MatSnackBar,
    private _route: ActivatedRoute,
    private _router: Router,
    private _hotkeys: HotkeysService,
  ) {
    afterNextRender(() => {
      this._hotkeys.setSequenceDebounce(500);

      this._hotkeys.registerHelpModal(() => {
        HelpComponent.toggleHelp(_dialog);
      });

      this._hotkeys
        .addShortcut({
          keys: 'down',
          description: 'Select next checklist item',
          preventDefault: true,
          group: 'Navigation',
        })
        .subscribe(() => {
          this.items!.selectNextItem();
        });
      this._hotkeys
        .addShortcut({
          keys: 'up',
          description: 'Select previous checklist item',
          preventDefault: true,
          group: 'Navigation',
        })
        .subscribe(() => {
          this.items!.selectPreviousItem();
        });
      this._hotkeys
        .addShortcut({
          keys: 'meta.down',
          description: 'Select next checklist',
          preventDefault: true,
          group: 'Navigation',
        })
        .subscribe(() => {
          this.tree?.selectNextChecklist();
        });
      this._hotkeys
        .addShortcut({
          keys: 'meta.up',
          description: 'Select next checklist',
          preventDefault: true,
          group: 'Navigation',
        })
        .subscribe(() => {
          this.tree?.selectPreviousChecklist();
        });
      // TODO: meta.shift.up/down to reorder checklists
      // TODO: Group navigation/reordering shortcuts

      this._hotkeys
        .addShortcut({
          keys: 'enter',
          description: 'Edit checklist item',
          preventDefault: true,
          trigger: 'keyup',
          group: 'Editing',
        })
        .subscribe(() => {
          this.items!.editCurrentItem();
        });
      this._hotkeys
        .addShortcut({
          keys: 'shift.right',
          description: 'Indent checklist item',
          preventDefault: true,
          group: 'Editing',
        })
        .subscribe(() => {
          this.items!.indentCurrentItem(1);
        });
      this._hotkeys
        .addShortcut({
          keys: 'shift.left',
          description: 'Unident checklist item',
          preventDefault: true,
          group: 'Editing',
        })
        .subscribe(() => {
          this.items!.indentCurrentItem(-1);
        });
      this._hotkeys
        .addShortcut({
          keys: 'shift.C',
          description: 'Toggle checklist item centering',
          preventDefault: true,
          group: 'Editing',
        })
        .subscribe(() => {
          this.items!.toggleCurrentItemCenter();
        });
      this._hotkeys
        .addShortcut({
          keys: 'shift.up',
          description: 'Move checklist item up',
          preventDefault: true,
          group: 'Editing',
        })
        .subscribe(() => {
          this.items!.moveCurrentItemUp();
        });
      this._hotkeys
        .addShortcut({
          keys: 'shift.down',
          description: 'Move checklist item down',
          preventDefault: true,
          group: 'Editing',
        })
        .subscribe(() => {
          this.items!.moveCurrentItemDown();
        });

      const NEW_ITEM_SHORTCUTS = [
        { secondKey: 'r', typeDescription: 'challenge/response', type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE },
        { secondKey: 'c', typeDescription: 'challenge', type: ChecklistItem_Type.ITEM_CHALLENGE },
        { secondKey: 'x', typeDescription: 'text', type: ChecklistItem_Type.ITEM_PLAINTEXT },
        { secondKey: 't', typeDescription: 'title', type: ChecklistItem_Type.ITEM_TITLE },
        { secondKey: 'w', typeDescription: 'warning', type: ChecklistItem_Type.ITEM_WARNING },
        { secondKey: 'a', typeDescription: 'caution', type: ChecklistItem_Type.ITEM_CAUTION },
        { secondKey: 'n', typeDescription: 'note', type: ChecklistItem_Type.ITEM_NOTE },
        { secondKey: 'b', typeDescription: 'blank', type: ChecklistItem_Type.ITEM_SPACE },
      ];
      for (const shortcut of NEW_ITEM_SHORTCUTS) {
        this._hotkeys
          .addSequenceShortcut({
            keys: `n>${shortcut.secondKey}`,
            description: `Add new ${shortcut.typeDescription} item`,
            preventDefault: true,
            group: 'Adding',
          })
          .subscribe(() => {
            this.items!.onNewItem(shortcut.type);
          });
      }
    });
  }

  ngOnInit() {
    this._route.fragment.subscribe(async (fragment) => {
      // We use fragment-based navigation because of the routing limitations associated with GH Pages.
      // (yes, I could make 404.html point to index.html, but that's just horrible)
      await this._onFragmentChange(fragment);
    });
  }

  ngOnDestroy() {
    this._hotkeys.removeShortcuts(this._hotkeys.getHotkeys().map((hk) => hk.keys));
  }

  private loadingFragment = false;
  private async _onFragmentChange(fragment: string | null) {
    if (this.loadingFragment) {
      // We're the ones setting the fragment, changes are being made directly.
      return;
    }
    this.loadingFragment = true;

    const parsed = this._parseFragment(fragment);
    const fileName = parsed.fileName;

    if (fileName !== this.selectedFile?.metadata?.name) {
      await this.onFileSelected(fileName);
    }

    if (fileName) {
      this._loadFragmentChecklist(parsed);
    }
    this.loadingFragment = false;
  }

  _loadFragmentChecklist(parsed: ParsedFragment) {
    if (!this.selectedFile) {
      this._snackBar.open(`Failed to load file "${parsed.fileName}".`, '', { duration: 5000 });
      return;
    }

    let checklist: Checklist | undefined;
    if (parsed.checklistIdx !== undefined && parsed.groupIdx !== undefined) {
      if (this.selectedFile.groups.length <= parsed.groupIdx) {
        this._snackBar.open(`File ${parsed.fileName} does not have group ${parsed.groupIdx} - check your URL.`, '', {
          duration: 5000,
        });
        return;
      }

      const group = this.selectedFile.groups[parsed.groupIdx];
      if (group.checklists.length <= parsed.checklistIdx) {
        this._snackBar.open(
          `Group ${parsed.groupIdx} in file ${parsed.fileName} has no checklist ${parsed.checklistIdx} - check your URL.`,
          '',
          { duration: 5000 },
        );
        return;
      }

      checklist = group.checklists[parsed.checklistIdx];
    }
    this.tree!.selectedChecklist = checklist;
  }

  private _parseFragment(fragment: string | null): ParsedFragment {
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

  private _buildFragment(): string {
    if (!this.selectedFile || !this.selectedFile.metadata?.name) {
      return '';
    }

    if (!this.tree || !this.tree.selectedChecklist) {
      return this.selectedFile.metadata.name;
    }

    // TODO: Can probably use the tree node indices directly instead.
    for (const [groupIdx, group] of this.selectedFile.groups.entries()) {
      if (group === this.tree.selectedChecklistGroup) {
        for (const [checklistIdx, checklist] of group.checklists.entries()) {
          if (checklist === this.tree.selectedChecklist) {
            return `${this.selectedFile.metadata.name}/${groupIdx}/${checklistIdx}`;
          }
        }
      }
    }

    return this.selectedFile.metadata.name;
  }

  private async _updateFragment() {
    if (this.loadingFragment) {
      // We're in the middle of setting a fragment - that triggers loading
      // the file, which then triggers an _updateFragment call (and even
      // worse, before a checklist is selected, which would result in a
      // different fragment) - avoid the loop.
      return;
    }

    await this._router.navigate([], {
      fragment: this._buildFragment(),
      onSameUrlNavigation: 'ignore',
    });
  }

  onNewFile() {
    this.showFilePicker = false;
    this.showFileUpload = false;

    const name = prompt('Enter a name for the new file:');
    if (!name) {
      return;
    }

    // Save an empty file with that name.
    const file: ChecklistFile = {
      groups: [
        {
          title: 'First checklist group',
          checklists: [
            {
              title: 'First checklist',
              items: [
                {
                  type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
                  prompt: 'Checklist created',
                  expectation: 'CHECK',
                  centered: false,
                  indent: 0,
                },
              ],
            },
          ],
        },
      ],
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
    } else if (formatId === 'dynon31') {
      file = await DynonFormat.fromProto(this.selectedFile, 'checklist.txt', 31);
    } else if (formatId === 'dynon40') {
      file = await DynonFormat.fromProto(this.selectedFile, 'checklist.txt', 40);
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

    const name = this.selectedFile.metadata!.name;
    // TODO: Look into using a framework that makes nicer dialogs, like ng-bootstrap, sweetalert, sweetalert2 or ng-vibe
    if (!confirm(`Are you sure you'd like to delete checklist file "${name}"??`)) return;

    this.store.deleteChecklistFile(name);
    this._displayFile(undefined);
    this._snackBar.open(`Deleted checklist "${name}".`, '', { duration: 2000 });
  }

  onFileInfo() {
    this.showFilePicker = false;
    this.showFileUpload = false;

    if (!this.selectedFile) return;

    const dialogData = {
      metadata: ChecklistFileMetadata.clone(this.selectedFile.metadata!),
      allGroups: this.selectedFile.groups,
    };
    const dialogRef = this._dialog.open(ChecklistFileInfoComponent, {
      data: dialogData,
      hasBackdrop: true,
      closeOnNavigation: true,
      enterAnimationDuration: 200,
      exitAnimationDuration: 200,
      role: 'dialog',
      ariaModal: true,
    });

    dialogRef.afterClosed().subscribe((updatedData: FileInfoDialogData) => {
      if (!updatedData || !this.selectedFile) return;

      const oldName = this.selectedFile.metadata!.name;
      const newName = updatedData.metadata.name;
      this.selectedFile.metadata = updatedData.metadata;
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

  async onChecklistSelected() {
    await this._updateFragment();
  }

  private async _displayFile(file?: ChecklistFile) {
    this.selectedFile = file;
    if (this.tree) {
      this.tree.file = file;
    }
    if (file?.metadata) {
      // Make the file selected the next time the picker gets displayed
      this.filePicker!.selectedFile = file.metadata.name;
      this._snackBar.open(`Loaded checklist "${file.metadata?.name}".`, '', { duration: 2000 });
    }

    await this._updateFragment();

    // TODO: Add filename to topbar, add rename pencil there
  }

  onFileChanged(file: ChecklistFile) {
    this.store.saveChecklistFile(file);
  }

  onChecklistChanged() {
    if (this.selectedFile) {
      this.store.saveChecklistFile(this.selectedFile);
    }
  }
}
