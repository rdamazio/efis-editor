import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { ChangeDetectorRef, Component, HostListener, inject, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterOutlet } from '@angular/router';
import { HotkeysService } from '@ngneat/hotkeys';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { SwalComponent, SwalPortalTargets, SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';
import { firstValueFrom, Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { DriveSyncState, GoogleDriveStorage } from '../../model/storage/gdrive';
import { AboutComponent } from '../about/about.component';
import { HelpComponent } from '../checklists/hotkeys/help/help.component';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

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
    MatMenuModule,
    MatSidenavModule,
    MatSnackBarModule,
    MatToolbarModule,
    MatTooltipModule,
    RouterLink,
    RouterOutlet,
    SweetAlert2Module,
  ],
})
@UntilDestroy()
export class NavComponent {
  @ViewChild('cloudSyncSwal')
  public readonly syncSwal!: SwalComponent;

  private readonly _breakpointObserver = inject(BreakpointObserver);

  isHandset$: Observable<boolean> = this._breakpointObserver.observe(Breakpoints.Handset).pipe(
    map((result) => result.matches),
    shareReplay(),
  );

  cloudIconDisabled = false;
  disconnectCloudDisabled = true;
  needsSync = false;
  cloudIcon = '';
  cloudIconTooltip = '';

  constructor(
    protected hotkeys: HotkeysService,
    protected readonly swalTargets: SwalPortalTargets,
    private readonly _dialog: MatDialog,
    private readonly _snackBar: MatSnackBar,
    private readonly _gdrive: GoogleDriveStorage,
    private readonly _changeDet: ChangeDetectorRef,
  ) {
    this._gdrive.getState().pipe(untilDestroyed(this)).subscribe(this._updateCloudUi.bind(this));
    this._gdrive.onErrors().pipe(untilDestroyed(this)).subscribe(this._onSyncError.bind(this));
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

  async startCloudSync() {
    const currentState = await firstValueFrom(this._gdrive.getState());
    if (currentState === DriveSyncState.DISCONNECTED) {
      return this.syncSwal.fire();
    } else {
      return this.synchronizeToCloud();
    }
  }

  async synchronizeToCloud() {
    return this._gdrive.synchronize();
  }

  async disableCloudSync(deleteData: boolean) {
    if (deleteData) {
      await this._gdrive.deleteAllData();
    }
    return this._gdrive.disableSync(true);
  }

  private _updateCloudUi(state: DriveSyncState) {
    this.cloudIconDisabled = false;
    this.disconnectCloudDisabled = false;
    this.needsSync = false;

    switch (state) {
      case DriveSyncState.DISCONNECTED:
        this.disconnectCloudDisabled = true;
        this.cloudIcon = 'cloud_off';
        this.cloudIconTooltip = 'Google drive disconnected. Click to connect and synchronize.';
        break;
      case DriveSyncState.SYNCING:
        this.cloudIconDisabled = true;
        this.cloudIcon = 'cloud_sync';
        this.cloudIconTooltip = 'Google Drive synchronization in progress...';
        break;
      case DriveSyncState.NEEDS_SYNC:
        this.needsSync = true;
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

  private _onSyncError(error: string) {
    const snack = this._snackBar.open(error, 'Retry sync', {
      duration: 5000,
    });
    snack.onAction().subscribe(() => {
      void this._gdrive.synchronize();
    });
  }

  @HostListener('window:beforeunload')
  onPageUnload() {
    if (this.needsSync) {
      // Get synchronization going right away. There's no guarantee that it'll complete.
      void this._gdrive.synchronize();

      // Trigger a confirmation dialog.
      return false;
    }
    return true;
  }
}
