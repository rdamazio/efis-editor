import { Component, inject, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BROWSERS, DeviceDetectorService } from 'ngx-device-detector';
import { NgxFileDropEntry, NgxFileDropModule } from 'ngx-file-drop';
import { ChecklistFile } from '../../../../gen/ts/checklist';
import { FORMAT_REGISTRY, parseChecklistFile } from '../../../model/formats/format-registry';

@Component({
  selector: 'checklist-file-upload',
  imports: [MatIconModule, NgxFileDropModule],
  templateUrl: './file-upload.component.html',
  styleUrl: './file-upload.component.scss',
})
export class ChecklistFileUploadComponent {
  private readonly _deviceService = inject(DeviceDetectorService);
  readonly fileUploaded = output<ChecklistFile>();
  protected readonly _accept =
    FORMAT_REGISTRY.getSupportedInputExtensions() +
    (this._deviceService.deviceInfo().browser === BROWSERS.SAFARI
      ? ', ' + FORMAT_REGISTRY.getSupportedMimeTypes()
      : '');
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
