import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { HotkeyGroup, HotkeysService } from '@ngneat/hotkeys';
import { ShortcutPipe } from './shortcut.pipe';

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatTableModule,
    ShortcutPipe,
  ],
  templateUrl: './help.component.html',
  styleUrl: './help.component.scss',
})
export class HelpComponent {
  DISPLAYED_COLUMNS = ['action', 'key'];
  hotkeys: HotkeyGroup[];
  private static _helpRef?: MatDialogRef<HelpComponent>;

  constructor(
    public dialogRef: MatDialogRef<HelpComponent>,
    hotkeysService: HotkeysService,
  ) {
    this.hotkeys = hotkeysService.getShortcuts();
  }

  static toggleHelp(dialog: MatDialog) {
    if (this._helpRef) {
      this._helpRef.close();
      return;
    }

    this._helpRef = dialog.open(HelpComponent, {
      hasBackdrop: true,
      width: '500px',
    });

    this._helpRef.afterClosed().subscribe(() => {
      this._helpRef = undefined;
    });
  }
}
