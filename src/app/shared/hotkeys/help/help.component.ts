import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { HotkeyGroup, HotkeysService } from '@ngneat/hotkeys';
import { ShortcutPipe } from './shortcut.pipe';

@Component({
  selector: 'app-help',
  imports: [MatButtonModule, MatDialogTitle, MatDialogContent, MatDialogActions, MatTableModule, ShortcutPipe],
  templateUrl: './help.component.html',
  styleUrl: './help.component.scss',
})
export class HelpComponent {
  readonly columns = ['action', 'key'];
  hotkeys: HotkeyGroup[];
  private static _helpRef?: MatDialogRef<HelpComponent>;

  constructor(
    public dialogRef: MatDialogRef<HelpComponent>,
    hotkeysService: HotkeysService,
  ) {
    this.hotkeys = hotkeysService.getShortcuts();
  }

  static toggleHelp(dialog: MatDialog): MatDialogRef<HelpComponent> | undefined {
    if (this._helpRef) {
      this._helpRef.close();
      return undefined;
    }

    this._helpRef = dialog.open(HelpComponent, { hasBackdrop: true, width: '500px' });

    this._helpRef.afterClosed().subscribe(() => {
      this._helpRef = undefined;
    });

    return this._helpRef;
  }
}
