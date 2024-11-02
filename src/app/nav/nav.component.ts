import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterOutlet } from '@angular/router';
import { HotkeysService } from '@ngneat/hotkeys';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { DriveSyncState, GoogleDriveStorage } from '../../model/storage/gdrive';
import { AboutComponent } from '../about/about.component';
import { HelpComponent } from '../checklists/hotkeys/help/help.component';

@Component({
  selector: 'app-nav',
  templateUrl: './nav.component.html',
  styleUrl: './nav.component.scss',
  standalone: true,
  imports: [
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
@UntilDestroy()
export class NavComponent {
  private readonly _breakpointObserver = inject(BreakpointObserver);

  isHandset$: Observable<boolean> = this._breakpointObserver.observe(Breakpoints.Handset).pipe(
    map((result) => result.matches),
    shareReplay(),
  );

  cloudIconDisabled = false;
  cloudIcon = 'cloud_off';

  constructor(
    protected hotkeys: HotkeysService,
    private readonly _dialog: MatDialog,
    private readonly _gdrive: GoogleDriveStorage,
    private readonly _changeDet: ChangeDetectorRef,
  ) {
    this._gdrive.getState().pipe(untilDestroyed(this)).subscribe(this._updateCloudUi.bind(this));
  }

  showAbout() {
    this._dialog.open(AboutComponent, {
      hasBackdrop: true,
      enterAnimationDuration: 200,
      exitAnimationDuration: 200,
    });
  }

  showKeyboardShortcuts() {
    if (this.hotkeys.getHotkeys().length === 0) {
      return;
    }

    HelpComponent.toggleHelp(this._dialog);
  }

  synchronizeToCloud() {
    void this._gdrive.synchronize();
  }

  private _updateCloudUi(state: DriveSyncState) {
    this.cloudIconDisabled = state === DriveSyncState.SYNCING;

    switch (state) {
      case DriveSyncState.DISCONNECTED:
        this.cloudIcon = 'cloud_off';
        break;
      case DriveSyncState.SYNCING:
        this.cloudIcon = 'cloud_sync';
        break;
      case DriveSyncState.NEEDS_SYNC:
        this.cloudIcon = 'cloud_upload';
        break;
      case DriveSyncState.IN_SYNC:
        this.cloudIcon = 'cloud_done';
        break;
      case DriveSyncState.FAILED:
        this.cloudIcon = 'cloud_alert';
        break;
    }

    this._changeDet.markForCheck();
  }
}
