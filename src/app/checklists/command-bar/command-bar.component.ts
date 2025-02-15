import { NgFor } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DeleteDialogComponent } from '../dialogs/delete-dialog/delete-dialog.component';
import { TitleDialogComponent } from '../dialogs/title-dialog/title-dialog.component';

export interface DownloadFormat {
  id: string;
  name: string;
}

@Component({
  selector: 'checklist-command-bar',
  imports: [MatButtonModule, MatDialogModule, MatIconModule, MatMenuModule, MatTooltipModule, NgFor],
  templateUrl: './command-bar.component.html',
  styleUrl: './command-bar.component.scss',
})
export class ChecklistCommandBarComponent {
  readonly hasFiles = input.required<boolean>();
  readonly fileIsOpen = input.required<boolean>();
  readonly downloadFormats = input.required<DownloadFormat[]>();
  readonly newFile = output<string>(); // Emits filename
  readonly openFile = output<boolean>();
  readonly uploadFile = output<boolean>();
  readonly downloadFile = output<string>();
  readonly deleteFile = output<boolean>();
  readonly fileInfo = output<boolean>();

  constructor(private readonly _dialog: MatDialog) {}

  isValidFileName(name: string): string | undefined {
    if (!name) {
      return 'A name must be provided!';
    }
    return undefined;
  }

  async onNewFile() {
    const title = await TitleDialogComponent.promptForTitle({ promptType: 'file' }, this._dialog);
    if (title) {
      this.newFile.emit(title);
    }
  }

  async onDeleteFile() {
    const confirmed = await DeleteDialogComponent.confirmDeletion(
      { entityType: 'file', entityDescription: 'this file and all checklists within' },
      this._dialog,
    );

    if (confirmed) {
      this.deleteFile.emit(true);
    }
  }
}
