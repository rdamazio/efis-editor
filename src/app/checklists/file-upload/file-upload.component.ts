import { Component, EventEmitter, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FileSystemFileEntry, NgxFileDropEntry, NgxFileDropModule } from 'ngx-file-drop';
import { ChecklistFile } from '../../../../gen/ts/checklist';
import { AceFormat } from '../../../model/formats/ace-format';
import { DynonFormat } from '../../../model/formats/dynon-format';
import { ForeFlightFormat } from '../../../model/formats/foreflight-format';
import { ForeFlightUtils } from '../../../model/formats/foreflight-utils';
import { GrtFormat } from '../../../model/formats/grt-format';
import { JsonFormat } from '../../../model/formats/json-format';

@Component({
  selector: 'checklist-file-upload',
  standalone: true,
  imports: [MatIconModule, NgxFileDropModule],
  templateUrl: './file-upload.component.html',
  styleUrl: './file-upload.component.scss',
})
export class ChecklistFileUploadComponent {
  @Output() fileUploaded = new EventEmitter<ChecklistFile>();

  constructor(private _snackBar: MatSnackBar) {}

  protected readonly ForeFlightUtils = ForeFlightUtils;

  async onDropped(files: NgxFileDropEntry[]) {
    const uploads: Promise<unknown>[] = [];
    for (const f of files) {
      const fileEntry = f.fileEntry as FileSystemFileEntry;
      uploads.push(
        fileEntry.file(async (file: File) => {
          const extension = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase();

          if (extension === 'fmd') {
            try {
              this.fileUploaded.emit(await ForeFlightFormat.toProto(file));
              return;
            } catch (e) {
              console.error('Failed to parse as ForeFlight: ', e);
            }
          } else if (extension === 'ace') {
            try {
              this.fileUploaded.emit(await AceFormat.toProto(file));
              return;
            } catch (e) {
              console.error('Failed to parse as ACE: ', e);
            }
          } else if (extension === 'txt') {
            try {
              this.fileUploaded.emit(await GrtFormat.toProto(file));
              return;
            } catch (e) {
              console.error('Failed to parse as GRT: ', e);
            }
            try {
              this.fileUploaded.emit(await DynonFormat.toProto(file));
              return;
            } catch (e) {
              console.error('Failed to parse as Dynon: ', e);
            }
          } else if (extension === 'afd') {
            try {
              this.fileUploaded.emit(await DynonFormat.toProto(file));
              return;
            } catch (e) {
              console.error('Failed to parse as AFD: ', e);
            }
          } else if (extension === 'json') {
            try {
              this.fileUploaded.emit(await JsonFormat.toProto(file));
              return;
            } catch (e) {
              console.error('Failed to parse as JSON: ', e);
            }
          } else {
            console.error(`Unknown file extension "${extension}".`);
          }

          this._snackBar.open(`Failed to parse uploaded file.`, '', { duration: 5000 });
        }),
      );
    }
    await Promise.all(uploads);
  }
}
