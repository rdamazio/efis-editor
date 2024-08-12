import { Component, EventEmitter, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FileSystemFileEntry, NgxFileDropEntry, NgxFileDropModule } from 'ngx-file-drop';
import { ChecklistFile } from '../../../../gen/ts/checklist';
import { AceFormat } from '../../../model/formats/ace-format';
import { DynonFormat } from '../../../model/formats/dynon-format';
import { GrtFormat } from '../../../model/formats/grt-format';

@Component({
  selector: 'checklist-file-upload',
  standalone: true,
  imports: [
    MatIconModule,
    NgxFileDropModule,
  ],
  templateUrl: './file-upload.component.html',
  styleUrl: './file-upload.component.scss'
})
export class ChecklistFileUploadComponent {
  @Output() fileUploaded = new EventEmitter<ChecklistFile>();

  constructor(private _snackBar: MatSnackBar) { }

  onDropped(files: NgxFileDropEntry[]) {
    for (const f of files) {
      const fileEntry = f.fileEntry as FileSystemFileEntry;
      fileEntry.file(async (file: File) => {
        // TODO: Come up with a nicer way to see which should match.
        try {
          this.fileUploaded.emit(await AceFormat.toProto(file));
          return;
        } catch (e) {
          console.log('Failed to parse as ACE: ', e);
        }
        try {
          this.fileUploaded.emit(await GrtFormat.toProto(file));
          return;
        } catch (e) {
          console.log('Failed to parse as GRT: ', e);
        }
        try {
          this.fileUploaded.emit(await DynonFormat.toProto(file));
          return;
        } catch (e) {
          console.log('Failed to parse as Dynon: ', e);
        }

        this._snackBar.open(`Failed to parse uploaded file.`, '', { duration: 5000 });
      });
    }
  }
}
