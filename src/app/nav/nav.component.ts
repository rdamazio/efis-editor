import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterOutlet } from '@angular/router';
import { HotkeysService } from '@ngneat/hotkeys';
import { map, Observable, shareReplay } from 'rxjs';
import { AboutComponent } from '../about/about.component';
import { HelpComponent } from '../checklists/hotkeys/help/help.component';
import { GoogleDriveComponent } from './gdrive.component';

@Component({
  selector: 'app-nav',
  templateUrl: './nav.component.html',
  styleUrl: './nav.component.scss',
  imports: [
    GoogleDriveComponent,
    MatButtonModule,
    MatDialogModule,
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
  private readonly _breakpointObserver = inject(BreakpointObserver);

  isHandset$: Observable<boolean> = this._breakpointObserver.observe(Breakpoints.Handset).pipe(
    map((result) => result.matches),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  constructor(
    protected _hotkeys: HotkeysService,
    private readonly _dialog: MatDialog,
  ) {}

  showAbout() {
    this._dialog.open(AboutComponent, {
      hasBackdrop: true,
      enterAnimationDuration: 200,
      exitAnimationDuration: 200,
    });
  }

  showKeyboardShortcuts() {
    if (this._hotkeys.getHotkeys().length === 0) {
      return;
    }

    HelpComponent.toggleHelp(this._dialog);
  }
}
