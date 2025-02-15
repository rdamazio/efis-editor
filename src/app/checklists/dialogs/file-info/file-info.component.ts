import { Component, Inject } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { lastValueFrom, Observable } from 'rxjs';
import { ChecklistFileMetadata, ChecklistGroup } from '../../../../../gen/ts/checklist';

export interface FileInfoDialogData {
  metadata: ChecklistFileMetadata;
  allGroups: ChecklistGroup[];
}

@Component({
  selector: 'checklist-info-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  templateUrl: './file-info.component.html',
  styleUrl: './file-info.component.scss',
})
export class ChecklistFileInfoComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: FileInfoDialogData) {}

  get defaultChecklist(): string {
    return `${this.data.metadata.defaultGroupIndex}.${this.data.metadata.defaultChecklistIndex}`;
  }
  set defaultChecklist(val: string) {
    const dotIdx = val.indexOf('.');
    if (dotIdx === -1) {
      throw new Error(`Invalid checklist value "${val}"`);
    }

    this.data.metadata.defaultGroupIndex = parseInt(val.slice(0, dotIdx), 10);
    this.data.metadata.defaultChecklistIndex = parseInt(val.slice(dotIdx + 1), 10);
  }

  public static async showFileInfo(
    metadata: ChecklistFileMetadata,
    groups: ChecklistGroup[],
    dialog: MatDialog,
  ): Promise<ChecklistFileMetadata | undefined> {
    const dialogData = { metadata: ChecklistFileMetadata.clone(metadata), allGroups: groups };

    const dialogRef = dialog.open(ChecklistFileInfoComponent, {
      data: dialogData,
      hasBackdrop: true,
      closeOnNavigation: true,
      enterAnimationDuration: 200,
      exitAnimationDuration: 200,
      role: 'dialog',
      ariaModal: true,
    });

    const afterClosed$ = dialogRef.afterClosed() as Observable<ChecklistFileMetadata | undefined>;
    return lastValueFrom(afterClosed$, { defaultValue: undefined });
  }
}
