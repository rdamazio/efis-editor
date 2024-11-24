import { AsyncPipe, isPlatformServer } from '@angular/common';
import {
  afterNextRender,
  AfterViewInit,
  Component,
  Inject,
  Injector,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { HotkeysService } from '@ngneat/hotkeys';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { saveAs } from 'file-saver';
import { NgxSpinnerModule, NgxSpinnerService } from 'ngx-spinner';
import { firstValueFrom } from 'rxjs';
import {
  Checklist,
  ChecklistFile,
  ChecklistFileMetadata,
  ChecklistGroup_Category,
  ChecklistItem_Type,
} from '../../../gen/ts/checklist';
import { AceFormat } from '../../model/formats/ace-format';
import { DynonFormat } from '../../model/formats/dynon-format';
import { FormatError } from '../../model/formats/error';
import { ForeFlightFormat } from '../../model/formats/foreflight-format';
import { ForeFlightUtils } from '../../model/formats/foreflight-utils';
import { GrtFormat } from '../../model/formats/grt-format';
import { JsonFormat } from '../../model/formats/json-format';
import { PdfFormat } from '../../model/formats/pdf-format';
import { PdfWriterOptions } from '../../model/formats/pdf-writer';
import { ChecklistStorage } from '../../model/storage/checklist-storage';
import { GoogleDriveStorage } from '../../model/storage/gdrive';
import { ChecklistTreeBarComponent } from './checklist-tree/bar/bar.component';
import { ChecklistTreeComponent } from './checklist-tree/checklist-tree.component';
import { ChecklistCommandBarComponent } from './command-bar/command-bar.component';
import { ChecklistFileInfoComponent, FileInfoDialogData } from './file-info/file-info.component';
import { ChecklistFilePickerComponent } from './file-picker/file-picker.component';
import { ChecklistFileUploadComponent } from './file-upload/file-upload.component';
import { HelpComponent } from './hotkeys/help/help.component';
import { ChecklistItemsComponent } from './items-list/items-list.component';
import { ExportDialogComponent } from './export-dialog/export-dialog.component';

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
    ChecklistFileUploadComponent,
    ChecklistItemsComponent,
    ChecklistTreeBarComponent,
    ChecklistTreeComponent,
    MatDialogModule,
    NgxSpinnerModule,
  ],
  templateUrl: './checklists.component.html',
  styleUrl: './checklists.component.scss',
})
@UntilDestroy()
export class ChecklistsComponent implements OnInit, AfterViewInit, OnDestroy {
  selectedFile?: ChecklistFile;
  @ViewChild('tree') tree?: ChecklistTreeComponent;
  @ViewChild('items') items?: ChecklistItemsComponent;
  @ViewChild('filePicker') filePicker?: ChecklistFilePickerComponent;

  showFilePicker = false;
  showFileUpload = false;

  private _loadingFragment = false;

  protected readonly ForeFlightUtils = ForeFlightUtils;
  protected readonly DOWNLOAD_SPINNER = 'download-spinner';

  constructor(
    public store: ChecklistStorage,
    private readonly _gdrive: GoogleDriveStorage,
    private readonly _dialog: MatDialog,
    private readonly _snackBar: MatSnackBar,
    private readonly _spinner: NgxSpinnerService,
    private readonly _route: ActivatedRoute,
    private readonly _router: Router,
    private readonly _hotkeys: HotkeysService,
    private readonly _injector: Injector,
    @Inject(PLATFORM_ID) private readonly _platformId: object,
  ) {}

  ngAfterViewInit() {
    // Shortcut registration affects global state which then changes the parent NavComponent.
    setTimeout(() => {
      this._registerKeyboardShortcuts();
    });

    this._gdrive
      .onDownloads()
      .pipe(untilDestroyed(this))
      .subscribe((name: string) => {
        if (this.selectedFile?.metadata?.name === name) {
          // The currently-displayed file was just replaced by a remote version - reload it.
          // Unfortunately, if the user is in the middle of typing something when this happens,
          // they may lose that unsaved edit.
          void this.onFileSelected(name);
          this._snackBar.open(`The currently-loaded file was replaced by a newer version.`, '', { duration: 5000 });
        }
      });
  }

  private _registerKeyboardShortcuts() {
    // Hotkey registration needs navigator.
    if (isPlatformServer(this._platformId)) return;

    this._hotkeys.setSequenceDebounce(500);

    this._hotkeys.registerHelpModal(() => {
      HelpComponent.toggleHelp(this._dialog);
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
        this.tree!.selectNextChecklist();
      });
    this._hotkeys
      .addShortcut({
        keys: 'meta.up',
        description: 'Select next checklist',
        preventDefault: true,
        group: 'Navigation',
      })
      .subscribe(() => {
        this.tree!.selectPreviousChecklist();
      });

    this._hotkeys
      .addShortcut({
        keys: 'alt.down',
        description: 'Select next checklist group',
        preventDefault: true,
        group: 'Navigation',
      })
      .subscribe(() => {
        this.tree!.selectNextGroup();
      });
    this._hotkeys
      .addShortcut({
        keys: 'alt.up',
        description: 'Select next checklist group',
        preventDefault: true,
        group: 'Navigation',
      })
      .subscribe(() => {
        this.tree!.selectPreviousGroup();
      });

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
        keys: 'delete',
        description: 'Delete checklist item',
        preventDefault: true,
        trigger: 'keyup',
        group: 'Editing',
      })
      .subscribe(() => {
        this.items!.deleteCurrentItem();
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
        group: 'Reordering',
      })
      .subscribe(() => {
        this.items!.moveCurrentItemUp();
      });
    this._hotkeys
      .addShortcut({
        keys: 'shift.down',
        description: 'Move checklist item down',
        preventDefault: true,
        group: 'Reordering',
      })
      .subscribe(() => {
        this.items!.moveCurrentItemDown();
      });
    this._hotkeys
      .addShortcut({
        keys: 'shift.meta.up',
        description: 'Move checklist up',
        preventDefault: true,
        group: 'Reordering',
      })
      .subscribe(() => {
        this.tree!.moveCurrentChecklistUp();
      });
    this._hotkeys
      .addShortcut({
        keys: 'shift.meta.down',
        description: 'Move checklist down',
        preventDefault: true,
        group: 'Reordering',
      })
      .subscribe(() => {
        this.tree!.moveCurrentChecklistDown();
      });
    this._hotkeys
      .addShortcut({
        keys: 'shift.alt.up',
        description: 'Move checklist group up',
        preventDefault: true,
        group: 'Reordering',
      })
      .subscribe(() => {
        this.tree!.moveCurrentGroupUp();
      });
    this._hotkeys
      .addShortcut({
        keys: 'shift.alt.down',
        description: 'Move checklist group down',
        preventDefault: true,
        group: 'Reordering',
      })
      .subscribe(() => {
        this.tree!.moveCurrentGroupDown();
      });

    this._hotkeys
      .addShortcut({
        keys: 'meta.i',
        description: 'Edit file information',
        preventDefault: true,
        group: 'Editing',
      })
      .subscribe(() => {
        const fn = async () => {
          await this.onFileInfo();
        };
        fn().catch(console.error.bind(console));
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
  }

  private _unregisterKeyboardShortcuts() {
    this._hotkeys.removeShortcuts(this._hotkeys.getHotkeys().map((hk) => hk.keys));
  }

  ngOnInit() {
    this._route.fragment.subscribe((fragment) => {
      const fn = async () => {
        // We use fragment-based navigation because of the routing limitations associated with GH Pages.
        // (yes, I could make 404.html point to index.html, but that's just horrible)
        await this._onFragmentChange(fragment);
      };
      fn().catch(console.error.bind(console));
    });
  }

  ngOnDestroy() {
    this._unregisterKeyboardShortcuts();
  }

  private async _onFragmentChange(fragment: string | null) {
    if (this._loadingFragment) {
      // We're the ones setting the fragment, changes are being made directly.
      return;
    }
    this._loadingFragment = true;

    const parsed = this._parseFragment(fragment);
    const fileName = parsed.fileName;

    if (fileName !== this.selectedFile?.metadata?.name) {
      await this.onFileSelected(fileName);
    }

    if (fileName) {
      this._loadFragmentChecklist(parsed);
    }
    this._loadingFragment = false;
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
    if (!this.selectedFile?.metadata?.name) {
      return '';
    }

    if (!this.tree?.selectedChecklist) {
      return this.selectedFile.metadata.name;
    }

    const selectedPos = this.tree.selectedChecklistPosition();
    if (selectedPos) {
      return `${this.selectedFile.metadata.name}/${selectedPos.groupIdx}/${selectedPos.checklistIdx}`;
    }
    return this.selectedFile.metadata.name;
  }

  private async _updateFragment() {
    if (this._loadingFragment) {
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

  async onNewFile(fileName: string) {
    this.showFilePicker = false;
    this.showFileUpload = false;

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
          category: ChecklistGroup_Category.normal,
        },
      ],
      metadata: ChecklistFileMetadata.create({
        name: fileName,
      }),
    };
    await Promise.all([this.store.saveChecklistFile(file), this._displayFile(file)]);
  }

  onOpenFile() {
    this.showFilePicker = !this.showFilePicker;
    this.showFileUpload = false;
  }

  onUploadFile() {
    this.showFilePicker = false;
    this.showFileUpload = !this.showFileUpload;
  }

  async onFileUploaded(file: ChecklistFile) {
    this.showFileUpload = false;

    await Promise.all([this.store.saveChecklistFile(file), this._displayFile(file)]);
  }

  async onDownloadFile(formatId: string) {
    this.showFilePicker = false;
    this.showFileUpload = false;

    if (!this.selectedFile) return;

    let file: Promise<File> | File;
    if (formatId === 'ace') {
      file = AceFormat.fromProto(this.selectedFile);
    } else if (formatId === 'json') {
      file = JsonFormat.fromProto(this.selectedFile);
    } else if (formatId === 'afs') {
      file = DynonFormat.fromProto(this.selectedFile, 'CHKLST.AFD');
    } else if (formatId === 'dynon') {
      file = DynonFormat.fromProto(this.selectedFile, 'checklist.txt');
    } else if (formatId === 'dynon31') {
      file = DynonFormat.fromProto(this.selectedFile, 'checklist.txt', 31);
    } else if (formatId === 'dynon40') {
      file = DynonFormat.fromProto(this.selectedFile, 'checklist.txt', 40);
    } else if (formatId === 'grt') {
      file = GrtFormat.fromProto(this.selectedFile);
    } else if (formatId === ForeFlightUtils.FILE_EXTENSION) {
      file = ForeFlightFormat.fromProto(this.selectedFile);
    } else if (formatId === 'pdf') {
      const pdfDialog = this._dialog.open(ExportDialogComponent, {
        hasBackdrop: true,
        closeOnNavigation: true,
        enterAnimationDuration: 200,
        exitAnimationDuration: 200,
        role: 'dialog',
        ariaModal: true,
      });
      const closePromise = firstValueFrom(pdfDialog.afterClosed());
      file = closePromise.then((options?: PdfWriterOptions): File => {
        if (options) {
          return PdfFormat.fromProto(this.selectedFile!, options);
        }
        throw new Error('PDF dialog cancelled');
      });
    } else {
      file = Promise.reject(new FormatError(`Unknown format "${formatId}"`));
    }

    // Some format generations, notably PDF, can take a while - show a spinner.
    return this._spinner
      .show(this.DOWNLOAD_SPINNER)
      .then(() => {
        // Let the spinner be rendered while we generate the file.
        return afterNextRender(
          () => {
            const fn = async () => {
              try {
                const f = await file;
                saveAs(f, f.name);
              } finally {
                await this._spinner.hide(this.DOWNLOAD_SPINNER);
              }
            };
            // eslint-disable-next-line promise/no-nesting
            fn().catch(console.error.bind(console));
          },
          { injector: this._injector },
        );
      })
      .catch(console.error.bind(console));
  }

  async onDeleteFile() {
    this.showFilePicker = false;
    this.showFileUpload = false;

    if (!this.selectedFile) return;

    const name = this.selectedFile.metadata!.name;

    await Promise.all([this.store.deleteChecklistFile(name), this._displayFile(undefined)]);
    this._snackBar.open(`Deleted checklist "${name}".`, '', { duration: 2000 });
  }

  async onFileInfo() {
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

    await firstValueFrom(dialogRef.afterClosed())
      .then(async (updatedData?: FileInfoDialogData): Promise<unknown> => {
        if (!updatedData || !this.selectedFile) return;

        const oldName = this.selectedFile.metadata!.name;
        const newName = updatedData.metadata.name;
        this.selectedFile.metadata = updatedData.metadata;
        const promises = [this.store.saveChecklistFile(this.selectedFile)];
        if (oldName !== newName) {
          // File was renamed, delete old one from storage.
          promises.push(this.store.deleteChecklistFile(oldName));
          this.filePicker!.selectedFile = newName;
          // TODO: Update fragment
        }
        return Promise.all(promises);
      })
      .catch(console.error.bind(console));
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
    await this._displayFile(file);
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
      this._snackBar.open(`Loaded checklist "${file.metadata.name}".`, '', { duration: 2000 });
    }

    await this._updateFragment();

    // TODO: Add filename to topbar, add rename pencil there
  }

  async onFileChanged(file: ChecklistFile) {
    await this.store.saveChecklistFile(file);
  }

  async onChecklistChanged() {
    if (this.selectedFile) {
      await this.store.saveChecklistFile(this.selectedFile);
    }
  }
}
