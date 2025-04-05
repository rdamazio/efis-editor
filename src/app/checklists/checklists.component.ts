import { AsyncPipe } from '@angular/common';
import {
  afterNextRender,
  AfterViewInit,
  Component,
  effect,
  Inject,
  Injector,
  OnDestroy,
  OnInit,
  Signal,
  viewChild,
} from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, ROUTER_OUTLET_DATA } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { saveAs } from 'file-saver';
import { NgxSpinnerModule, NgxSpinnerService } from 'ngx-spinner';
import { Subject } from 'rxjs';
import {
  Checklist,
  ChecklistFile,
  ChecklistFileMetadata,
  ChecklistGroup_Category,
  ChecklistItem_Type,
} from '../../../gen/ts/checklist';
import { FormatId } from '../../model/formats/format-id';
import { serializeChecklistFile } from '../../model/formats/format-registry';
import { ChecklistStorage } from '../../model/storage/checklist-storage';
import { GoogleDriveStorage } from '../../model/storage/gdrive';
import { PreferenceStorage } from '../../model/storage/preference-storage';
import { NavData } from '../nav/nav-data';
import { HotkeyRegistrar, HotkeyRegistree, HotkeyRegistry } from '../shared/hotkeys/hotkey-registration';
import { ChecklistTreeBarComponent } from './checklist-tree/bar/bar.component';
import { ChecklistTreeComponent } from './checklist-tree/checklist-tree.component';
import { ChecklistCommandBarComponent } from './command-bar/command-bar.component';
import { ChecklistFileInfoComponent } from './dialogs/file-info/file-info.component';
import { PrintDialogComponent } from './dialogs/print-dialog/print-dialog.component';
import { ChecklistFilePickerComponent } from './file-picker/file-picker.component';
import { ChecklistFileUploadComponent } from './file-upload/file-upload.component';
import { ChecklistItemsComponent } from './items-list/items-list.component';

interface ParsedFragment {
  fileName?: string;
  groupIdx?: number;
  checklistIdx?: number;
}

@UntilDestroy()
@Component({
  selector: 'app-checklists',
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
export class ChecklistsComponent implements OnInit, AfterViewInit, OnDestroy, HotkeyRegistree {
  static readonly NEW_ITEM_SHORTCUTS = [
    { secondKey: 'r', typeDescription: 'challenge/response', type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE },
    { secondKey: 'c', typeDescription: 'challenge', type: ChecklistItem_Type.ITEM_CHALLENGE },
    { secondKey: 'x', typeDescription: 'text', type: ChecklistItem_Type.ITEM_PLAINTEXT },
    { secondKey: 't', typeDescription: 'title', type: ChecklistItem_Type.ITEM_TITLE },
    { secondKey: 'w', typeDescription: 'warning', type: ChecklistItem_Type.ITEM_WARNING },
    { secondKey: 'a', typeDescription: 'caution', type: ChecklistItem_Type.ITEM_CAUTION },
    { secondKey: 'n', typeDescription: 'note', type: ChecklistItem_Type.ITEM_NOTE },
    { secondKey: 'b', typeDescription: 'blank row', type: ChecklistItem_Type.ITEM_SPACE },
  ];
  protected readonly _downloadSpinner = 'download-spinner';

  selectedFile?: ChecklistFile;
  readonly tree = viewChild.required<ChecklistTreeComponent>('tree');
  readonly items = viewChild.required<ChecklistItemsComponent>('items');

  showFilePicker = false;
  showFileUpload = false;

  private _loadingFragment = false;

  // For testing only.
  // eslint-disable-next-line rxjs-x/no-exposed-subjects
  storageCompleted$?: Subject<boolean>;

  // eslint-disable-next-line @typescript-eslint/max-params
  constructor(
    public store: ChecklistStorage,
    private readonly _gdrive: GoogleDriveStorage,
    private readonly _prefs: PreferenceStorage,
    private readonly _dialog: MatDialog,
    private readonly _snackBar: MatSnackBar,
    private readonly _spinner: NgxSpinnerService,
    private readonly _route: ActivatedRoute,
    private readonly _router: Router,
    private readonly _hotkeys: HotkeyRegistry,
    private readonly _injector: Injector,
    @Inject(ROUTER_OUTLET_DATA) private readonly _navData: Signal<NavData>,
  ) {}

  ngOnInit() {
    this._navData().routeTitle.set('Checklists');

    effect(
      () => {
        const fileName = this._navData().fileName();
        if (!fileName) return;
        void this.onFileRename(fileName);
      },
      { injector: this._injector },
    );

    this._route.fragment.pipe(untilDestroyed(this)).subscribe((fragment: string | null) => {
      const fn = async () => {
        // We use fragment-based navigation because of the routing limitations associated with GH Pages.
        // (yes, I could make 404.html point to index.html, but that's just horrible)
        await this._onFragmentChange(fragment);
      };
      fn().catch(console.error.bind(console));
    });
  }

  ngAfterViewInit() {
    this._hotkeys.registerShortcuts(this);

    this._gdrive
      .onDownloads()
      .pipe(untilDestroyed(this))
      .subscribe((name: string) => {
        if (this.selectedFile?.metadata?.name === name) {
          // The currently-displayed file was just replaced by a remote version - reload it.
          // Unfortunately, if the user is in the middle of typing something when this happens,
          // they may lose that unsaved edit.
          void this.onFileSelected(name);
          this._snackBar.open(`The currently-loaded file was replaced by a newer version.`, '');
        }
      });
  }

  ngOnDestroy() {
    this._navData().routeTitle.set(undefined);
    this._hotkeys.unregisterShortcuts(this);
  }

  registerHotkeys(hotkeys: HotkeyRegistrar) {
    hotkeys
      .addShortcut({
        keys: 'down',
        description: 'Select next checklist item',
        preventDefault: true,
        group: 'Navigation',
      })
      .subscribe(() => {
        this.items().selectNextItem();
      });
    hotkeys
      .addShortcut({
        keys: 'up',
        description: 'Select previous checklist item',
        preventDefault: true,
        group: 'Navigation',
      })
      .subscribe(() => {
        this.items().selectPreviousItem();
      });
    hotkeys
      .addShortcut({
        keys: 'meta.down',
        description: 'Select next checklist',
        preventDefault: true,
        group: 'Navigation',
      })
      .subscribe(() => {
        this.tree().selectNextChecklist();
      });
    hotkeys
      .addShortcut({ keys: 'meta.up', description: 'Select next checklist', preventDefault: true, group: 'Navigation' })
      .subscribe(() => {
        this.tree().selectPreviousChecklist();
      });

    hotkeys
      .addShortcut({
        keys: 'alt.down',
        description: 'Select next checklist group',
        preventDefault: true,
        group: 'Navigation',
      })
      .subscribe(() => {
        this.tree().selectNextGroup();
      });
    hotkeys
      .addShortcut({
        keys: 'alt.up',
        description: 'Select next checklist group',
        preventDefault: true,
        group: 'Navigation',
      })
      .subscribe(() => {
        this.tree().selectPreviousGroup();
      });

    hotkeys
      .addShortcut({
        keys: 'enter',
        description: 'Edit checklist item',
        preventDefault: true,
        trigger: 'keyup',
        group: 'Editing',
      })
      .subscribe(() => {
        this.items().editCurrentItem();
      });
    hotkeys
      .addShortcut({
        keys: 'delete',
        description: 'Delete checklist item',
        preventDefault: true,
        trigger: 'keyup',
        group: 'Editing',
      })
      .subscribe(() => {
        this.items().deleteCurrentItem();
      });
    hotkeys
      .addShortcut({
        keys: 'shift.right',
        description: 'Indent checklist item',
        preventDefault: true,
        group: 'Editing',
      })
      .subscribe(() => {
        this.items().indentCurrentItem(1);
      });
    hotkeys
      .addShortcut({
        keys: 'shift.left',
        description: 'Unident checklist item',
        preventDefault: true,
        group: 'Editing',
      })
      .subscribe(() => {
        this.items().indentCurrentItem(-1);
      });
    hotkeys
      .addShortcut({
        keys: 'shift.C',
        description: 'Toggle checklist item centering',
        preventDefault: true,
        group: 'Editing',
      })
      .subscribe(() => {
        this.items().toggleCurrentItemCenter();
      });
    hotkeys
      .addShortcut({
        keys: 'shift.up',
        description: 'Move checklist item up',
        preventDefault: true,
        group: 'Reordering',
      })
      .subscribe(() => {
        this.items().moveCurrentItemUp();
      });
    hotkeys
      .addShortcut({
        keys: 'shift.down',
        description: 'Move checklist item down',
        preventDefault: true,
        group: 'Reordering',
      })
      .subscribe(() => {
        this.items().moveCurrentItemDown();
      });
    hotkeys
      .addShortcut({
        keys: 'shift.meta.up',
        description: 'Move checklist up',
        preventDefault: true,
        group: 'Reordering',
      })
      .subscribe(() => {
        this.tree().moveCurrentChecklistUp();
      });
    hotkeys
      .addShortcut({
        keys: 'shift.meta.down',
        description: 'Move checklist down',
        preventDefault: true,
        group: 'Reordering',
      })
      .subscribe(() => {
        this.tree().moveCurrentChecklistDown();
      });
    hotkeys
      .addShortcut({
        keys: 'shift.alt.up',
        description: 'Move checklist group up',
        preventDefault: true,
        group: 'Reordering',
      })
      .subscribe(() => {
        this.tree().moveCurrentGroupUp();
      });
    hotkeys
      .addShortcut({
        keys: 'shift.alt.down',
        description: 'Move checklist group down',
        preventDefault: true,
        group: 'Reordering',
      })
      .subscribe(() => {
        this.tree().moveCurrentGroupDown();
      });

    hotkeys
      .addShortcut({ keys: 'meta.i', description: 'Edit file information', preventDefault: true, group: 'Editing' })
      .subscribe(() => {
        const fn = async () => {
          await this.onFileInfo();
        };
        fn().catch(console.error.bind(console));
      });

    for (const shortcut of ChecklistsComponent.NEW_ITEM_SHORTCUTS) {
      hotkeys
        .addSequenceShortcut({
          keys: `n>${shortcut.secondKey}`,
          description: `Add new ${shortcut.typeDescription} item`,
          preventDefault: true,
          group: 'Adding',
        })
        .subscribe(() => {
          this.items().onNewItem(shortcut.type);
        });
    }
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

  private _loadFragmentChecklist(parsed: ParsedFragment) {
    if (!this.selectedFile) {
      this._snackBar.open(`Failed to load file "${parsed.fileName}".`, '');
      return;
    }

    let checklist: Checklist | undefined;
    if (parsed.checklistIdx !== undefined && parsed.groupIdx !== undefined) {
      if (this.selectedFile.groups.length <= parsed.groupIdx) {
        this._snackBar.open(`File ${parsed.fileName} does not have group ${parsed.groupIdx} - check your URL.`, '');
        return;
      }

      const group = this.selectedFile.groups[parsed.groupIdx];
      if (group.checklists.length <= parsed.checklistIdx) {
        this._snackBar.open(
          `Group ${parsed.groupIdx} in file ${parsed.fileName} has no checklist ${parsed.checklistIdx} - check your URL.`,
          '',
        );
        return;
      }

      checklist = group.checklists[parsed.checklistIdx];
    }
    this.tree().selectedChecklist.set(checklist);
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
    const checklistIdx = parseInt(checklistIdxStr, 10);
    if (isNaN(checklistIdx)) {
      return { fileName: fragment };
    }
    const groupSepIdx = fragment.lastIndexOf('/', checklistSepIdx - 1);
    const groupIdxStr = fragment.substring(groupSepIdx + 1, checklistSepIdx);
    const groupIdx = parseInt(groupIdxStr, 10);
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

    const tree = this.tree();
    if (!tree.selectedChecklist()) {
      return this.selectedFile.metadata.name;
    }

    const selectedPos = tree.selectedChecklistPosition();
    if (selectedPos) {
      return `${this.selectedFile.metadata.name}/${selectedPos.groupIdx}/${selectedPos.checklistIdx}`;
    }
    return this.selectedFile.metadata.name;
  }

  private async _updateNavigation() {
    const name = this.selectedFile?.metadata?.name;
    this._navData().fileName.set(name);

    if (this._loadingFragment) {
      // We're in the middle of setting a fragment - that triggers loading
      // the file, which then triggers an _updateNavigation call (and even
      // worse, before a checklist is selected, which would result in a
      // different fragment) - avoid the loop.
      return;
    }

    await this._router.navigate([], { fragment: this._buildFragment(), onSameUrlNavigation: 'ignore' });
  }

  async onNewFile(fileName: string) {
    this.showFilePicker = false;
    this.showFileUpload = false;

    const existingFile = await this.store.getChecklistFile(fileName);
    if (existingFile !== null) {
      this._snackBar.open(`A file named "${fileName}" already exists.`, '');
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
          category: ChecklistGroup_Category.normal,
        },
      ],
      metadata: ChecklistFileMetadata.create({ name: fileName }),
    };
    await Promise.all([this.store.saveChecklistFile(file), this._displayFile(file)]);
    this._notifyComplete();
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
    this._notifyComplete();
  }

  async onDownloadFile(formatId: FormatId) {
    this.showFilePicker = false;
    this.showFileUpload = false;

    if (!this.selectedFile) return;

    const pdfRequested = formatId === FormatId.PDF;
    const pdfOptions = pdfRequested ? await PrintDialogComponent.show(this._dialog, this._prefs) : undefined;
    if (pdfRequested && pdfOptions === undefined) {
      throw new Error('PDF options dialog cancelled');
    }

    // Some format generations, notably PDF, can take a while - show a spinner.
    return this._spinner
      .show(this._downloadSpinner)
      .then(() =>
        afterNextRender(
          // Let the spinner be rendered while we generate the file.
          () => {
            const fn = async () => {
              try {
                const f = await serializeChecklistFile(this.selectedFile!, formatId, pdfOptions);
                saveAs(f, f.name);
              } finally {
                await this._spinner.hide(this._downloadSpinner);
              }
            };
            // eslint-disable-next-line promise/no-nesting
            fn().catch(console.error.bind(console));
          },
          { injector: this._injector },
        ),
      )
      .catch(console.error.bind(console));
  }

  async onDeleteFile() {
    this.showFilePicker = false;
    this.showFileUpload = false;

    if (!this.selectedFile) return;

    const name = this.selectedFile.metadata!.name;

    await Promise.all([this.store.deleteChecklistFile(name), this._displayFile(undefined)]);
    this._snackBar.open(`Deleted file "${name}".`, '');
    this._notifyComplete();
  }

  async onFileInfo() {
    this.showFilePicker = false;
    this.showFileUpload = false;

    if (!this.selectedFile) return;

    return ChecklistFileInfoComponent.showFileInfo(this.selectedFile.metadata!, this.selectedFile.groups, this._dialog)
      .then(this.onMetadataUpdate.bind(this))
      .catch(console.error.bind(console));
  }

  async onFileRename(fileName: string) {
    if (!this.selectedFile) return;

    // If the file was renamed by the navigation, update the name everywhere else.
    const oldMeta = this.selectedFile.metadata!;
    if (fileName !== oldMeta.name) {
      const newMeta = ChecklistFileMetadata.clone(oldMeta);
      newMeta.name = fileName;
      await this.onMetadataUpdate(newMeta);
    }
  }

  async onMetadataUpdate(updatedMetadata?: ChecklistFileMetadata): Promise<void> {
    if (!updatedMetadata || !this.selectedFile) return;

    const oldName = this.selectedFile.metadata!.name;
    const newName = updatedMetadata.name;
    this.selectedFile.metadata = updatedMetadata;
    const promises = [this.store.saveChecklistFile(this.selectedFile)];
    if (oldName !== newName) {
      // File was renamed, delete old one from storage.
      promises.push(this.store.deleteChecklistFile(oldName));
      promises.push(this._updateNavigation());
    }
    await Promise.all(promises);
    this._notifyComplete();
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
    await this._updateNavigation();
  }

  private async _displayFile(file?: ChecklistFile) {
    this.selectedFile = file;
    this.tree().file.set(file);

    if (file?.metadata) {
      this._snackBar.open(`Loaded checklist "${file.metadata.name}".`, '');
    }

    await this._updateNavigation();
  }

  async onChecklistChanged() {
    // If the change involved moving the selected checklist/group, we may need to update the fragment
    await this._updateNavigation();

    const file = this.selectedFile;
    if (file) {
      await this.store.saveChecklistFile(file);
    }

    this._notifyComplete();
  }

  private _notifyComplete() {
    // Signal completion, for testing.
    if (this.storageCompleted$) {
      this.storageCompleted$.next(true);
    }
  }
}
