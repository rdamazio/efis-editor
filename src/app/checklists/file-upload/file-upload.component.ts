import { Component, EventEmitter, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { FileLikeObject, FileUploadModule, FileUploader } from 'ng2-file-upload';
import { ChecklistFile } from '../../../../gen/ts/checklist';
import { AceFormat } from '../../../model/formats/ace-format';
import { GrtFormat } from '../../../model/formats/grt-format';
import { FormatError } from '../../../model/formats/error';
import { DynonFormat } from '../../../model/formats/dynon-format';

@Component({
  selector: 'checklist-file-upload',
  standalone: true,
  imports: [
    FileUploadModule,
    MatIconModule,
  ],
  templateUrl: './file-upload.component.html',
  styleUrl: './file-upload.component.scss'
})
export class ChecklistFileUploadComponent {
  @Output() fileUploaded = new EventEmitter<ChecklistFile>();
  @Output() cancel = new EventEmitter<ChecklistFile>();
  fileName: string = '';
  uploader: FileUploader;

  constructor() {
    this.uploader = new FileUploader({
      // We never upload to a server.
      url: '',
      filters: [
        {
          name: "extension",
          fn: this._fileExtensionFilter,
        }
      ],
    });
  }

  async onFile(files: File[]) {
    if (files) {
      const file = files[0];
      // TODO: Come up with a nicer way to see which should match.
      try {
        this.fileUploaded.emit(await AceFormat.toProto(files[0]));
      } catch (e) {
        console.log('Failed to parse as ACE.');
      }
      try {
        this.fileUploaded.emit(await GrtFormat.toProto(files[0]));
      } catch (e) {
        console.log('Failed to parse as GRT.');
      }
      try {
        this.fileUploaded.emit(await DynonFormat.toProto(files[0]));
      } catch (e) {
        console.log('Failed to parse as Dynon.');
      }
    }
  }

  private _fileExtensionFilter(item: FileLikeObject): boolean {
    return !!item.name?.endsWith(".ace") ||
           !!item.name?.endsWith(".txt") ||
           !!item.name?.endsWith(".afd");
  }

}
