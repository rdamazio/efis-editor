import { Component, EventEmitter, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { FileLikeObject, FileUploadModule, FileUploader } from 'ng2-file-upload';
import { ChecklistFile } from '../../../../gen/ts/checklist';

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

  onFile(files: File[]) {
    if (files) {
      files[0].arrayBuffer().then((contents) => {
        // TODO: File conversion
        let file : ChecklistFile = {
          name: "Sample upload",
          groups: [],
        };
        this.fileUploaded.emit(file);
      });
    }
  }

  private _fileExtensionFilter(item: FileLikeObject) : boolean {
    return !!item.name?.endsWith(".ace");
  }

}
