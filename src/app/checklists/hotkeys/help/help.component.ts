import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
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

  constructor(
    public dialogRef: MatDialogRef<HelpComponent>,
    hotkeysService: HotkeysService,
  ) {
    this.hotkeys = hotkeysService.getShortcuts();
  }
}
