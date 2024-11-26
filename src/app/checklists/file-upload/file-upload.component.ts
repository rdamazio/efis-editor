import { Component, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgxFileDropEntry, NgxFileDropModule } from 'ngx-file-drop';
import { ChecklistFile } from '../../../../gen/ts/checklist';
import { AceFormat } from '../../../model/formats/ace-format';
import { DynonFormat } from '../../../model/formats/dynon-format';
import { FormatError } from '../../../model/formats/error';
import { ForeFlightFormat } from '../../../model/formats/foreflight-format';
import { ForeFlightUtils } from '../../../model/formats/foreflight-utils';
import { GrtFormat } from '../../../model/formats/grt-format';
import { JsonFormat } from '../../../model/formats/json-format';

@Component({
  selector: 'checklist-file-upload',
  imports: [MatIconModule, NgxFileDropModule],
  templateUrl: './file-upload.component.html',
  styleUrl: './file-upload.component.scss',
})
export class ChecklistFileUploadComponent {
  readonly fileUploaded = output<ChecklistFile>();

  constructor(private readonly _snackBar: MatSnackBar) {}

  protected readonly ForeFlightUtils = ForeFlightUtils;

  async onDropped(files: NgxFileDropEntry[]) {
    const parsedFiles: Promise<ChecklistFile | void>[] = files
      .map(async (entry: NgxFileDropEntry): Promise<File> => {
        const fsEntry = entry.fileEntry as FileSystemFileEntry;

        return new Promise((resolve, reject) => {
          fsEntry.file(resolve, reject);
        });
      })
      .map(async (filePromise: Promise<File>): Promise<ChecklistFile | void> => {
        return filePromise
          .then(async (file: File): Promise<ChecklistFile> => {
            return this._parseFile(file);
          })
          .then((checklistFile: ChecklistFile): ChecklistFile => {
            this.fileUploaded.emit(checklistFile);
            return checklistFile;
          })
          .catch((reason: unknown) => {
            console.error('Failed to parse file: ', reason);
            this._snackBar.open(`Failed to parse uploaded file.`, '', { duration: 5000 });
          });
      });
    await Promise.all(parsedFiles);
  }

  private async _parseFile(file: File): Promise<ChecklistFile> {
    const extension = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase();
    if (extension === 'fmd') {
      return ForeFlightFormat.toProto(file);
    } else if (extension === 'ace') {
      return AceFormat.toProto(file);
    } else if (extension === 'txt') {
      return Promise.any([GrtFormat.toProto(file), DynonFormat.toProto(file)]);
    } else if (extension === 'afd') {
      return DynonFormat.toProto(file);
    } else if (extension === 'json') {
      return JsonFormat.toProto(file);
    } else {
      throw new FormatError(`Unknown file extension "${extension}".`);
    }
  }
}
