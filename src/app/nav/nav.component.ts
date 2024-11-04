import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
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
    MatTooltipModule,
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
  cloudIcon = '';
  cloudIconTooltip = '';

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
        this.cloudIconTooltip = 'Google drive disconnected. Click to connect and synchronize.';
        break;
      case DriveSyncState.SYNCING:
        this.cloudIcon = 'cloud_sync';
        this.cloudIconTooltip = 'Google Drive synchronization in progress...';
        break;
      case DriveSyncState.NEEDS_SYNC:
        this.cloudIcon = 'cloud_upload';
        this.cloudIconTooltip = 'Google Drive synchronization pending';
        break;
      case DriveSyncState.IN_SYNC:
        this.cloudIcon = 'cloud_done';
        this.cloudIconTooltip = 'In sync with Google Drive. Click to force synchronization.';
        break;
      case DriveSyncState.FAILED:
        this.cloudIcon = 'cloud_alert';
        this.cloudIconTooltip = 'Google drive synchronization failed.';
        break;
    }

    this._changeDet.markForCheck();
  }
}
