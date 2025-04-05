import { Component, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterOutlet } from '@angular/router';
import { HotkeysService } from '@ngneat/hotkeys';
import { MatIconButtonSizesModule } from 'mat-icon-button-sizes';
import { AboutComponent } from '../about/about.component';
import { EditableLabelComponent } from '../shared/editable-label/editable-label.component';
import { GoogleDriveComponent } from '../shared/gdrive/gdrive.component';
import { HelpComponent } from '../shared/hotkeys/help/help.component';
import { NavData } from './nav-data';

@Component({
  selector: 'app-nav',
  templateUrl: './nav.component.html',
  styleUrl: './nav.component.scss',
  imports: [
    EditableLabelComponent,
    GoogleDriveComponent,
    MatButtonModule,
    MatDialogModule,
    MatIconButtonSizesModule,
    MatIconModule,
    MatListModule,
    MatSidenavModule,
    MatToolbarModule,
    MatTooltipModule,
    RouterLink,
    RouterOutlet,
  ],
})
export class NavComponent {
  readonly navData: NavData = { routeTitle: signal(undefined), fileName: signal(undefined) };

  constructor(
    protected _hotkeys: HotkeysService,
    private readonly _dialog: MatDialog,
  ) {}

  showAbout() {
    this._dialog.open(AboutComponent, { hasBackdrop: true, enterAnimationDuration: 200, exitAnimationDuration: 200 });
  }

  showKeyboardShortcuts() {
    HelpComponent.toggleHelp(this._dialog);
  }
}
