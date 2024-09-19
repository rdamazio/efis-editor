import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterOutlet } from '@angular/router';
import { HotkeysService } from '@ngneat/hotkeys';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { AboutComponent } from '../about/about.component';
import { HelpComponent } from '../checklists/hotkeys/help/help.component';

@Component({
  selector: 'app-nav',
  templateUrl: './nav.component.html',
  styleUrl: './nav.component.scss',
  standalone: true,
  imports: [
    AsyncPipe,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatListModule,
    MatSidenavModule,
    MatToolbarModule,
    RouterLink,
    RouterOutlet,
  ],
})
export class NavComponent {
  private breakpointObserver = inject(BreakpointObserver);

  isHandset$: Observable<boolean> = this.breakpointObserver.observe(Breakpoints.Handset).pipe(
    map((result) => result.matches),
    shareReplay(),
  );

  constructor(
    public _hotkeys: HotkeysService,
    private _dialog: MatDialog,
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
