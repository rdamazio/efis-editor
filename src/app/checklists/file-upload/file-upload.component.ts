import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DeviceDetectorService, OS } from 'ngx-device-detector';
import { NgxFileDropEntry, NgxFileDropModule } from 'ngx-file-drop';
import { ChecklistFile } from '../../../../gen/ts/checklist';
import { FORMAT_REGISTRY, parseChecklistFile } from '../../../model/formats/format-registry';

@Component({
  selector: 'checklist-file-upload',
  imports: [MatIconModule, NgxFileDropModule],
  templateUrl: './file-upload.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './file-upload.component.scss',
})
export class ChecklistFileUploadComponent {
  readonly fileUploaded = output<ChecklistFile>();
  protected readonly _deviceService = inject(DeviceDetectorService);
  protected readonly _acceptExtensions =
    FORMAT_REGISTRY.getSupportedInputExtensions() +
    // Browsers on iOS ignore extensions, and if `accept` is not restricted, display a dialog asking to make a shot,
    // select one from the camera roll or upload a file. Specifying at least one (apparently arbitrary) MIME type
    // causes Safari to directly show an unrestricted file picker instead.
    (this._deviceService.deviceInfo().os === OS.IOS ? ', application/octet-stream' : '');

  constructor(private readonly _snackBar: MatSnackBar) {}

  async onDropped(files: NgxFileDropEntry[]) {
    const parsedFiles: Promise<void>[] = files
      .map(async (entry: NgxFileDropEntry): Promise<File> => {
        const fsEntry = entry.fileEntry as FileSystemFileEntry;

        return new Promise((resolve, reject) => {
          fsEntry.file(resolve, reject);
        });
      })
      .map(
        async (filePromise: Promise<File>): Promise<void> =>
          filePromise
            .then(async (file: File): Promise<ChecklistFile> => parseChecklistFile(file))
            .then((checklistFile: ChecklistFile) => {
              this.fileUploaded.emit(checklistFile);
              return void 0;
            })
            .catch((reason: unknown) => {
              console.error('Failed to parse file: ', reason);
              this._snackBar.open(`Failed to parse uploaded file.`, '');
            }),
      );
    return Promise.all(parsedFiles);
  }
}
