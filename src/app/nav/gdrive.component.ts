import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DriveSyncState, GoogleDriveStorage } from '../../model/storage/gdrive';
import { GoogleDriveConnectDialogComponent } from '../checklists/dialogs/gdrive-connect-dialog/gdrive-connect-dialog.component';
import { GoogleDriveDisconnectDialogComponent } from '../checklists/dialogs/gdrive-disconnect-dialog/gdrive-disconnect-dialog.component';

@Component({
  selector: 'gdrive-nav',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule, MatIconModule, MatMenuModule, MatSnackBarModule, MatTooltipModule],
  templateUrl: './gdrive.component.html',
  styleUrl: './gdrive.component.scss',
})
@UntilDestroy()
export class GoogleDriveComponent implements OnInit, OnDestroy {
  cloudIconDisabled = false;
  disconnectCloudDisabled = true;
  needsSync = false;
  needsConnectDialog = true;
  cloudIcon = '';
  cloudIconTooltip = '';

  constructor(
    private readonly _dialog: MatDialog,
    private readonly _snackBar: MatSnackBar,
    private readonly _gdrive: GoogleDriveStorage,
    private readonly _changeDet: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this._gdrive.getState().pipe(untilDestroyed(this)).subscribe(this._updateCloudUi.bind(this));
    this._gdrive.onErrors().pipe(untilDestroyed(this)).subscribe(this._onSyncError.bind(this));
    void this._gdrive.init();
  }

  ngOnDestroy() {
    this._gdrive.destroy();
  }

  async startCloudSync() {
    if (this.needsConnectDialog) {
      const confirmed = await GoogleDriveConnectDialogComponent.confirmConnection(this._dialog);
      if (!confirmed) return void 0;
    }

    return this.synchronizeToCloud();
  }

  async synchronizeToCloud() {
    return this._gdrive.synchronize();
  }

  async disconnectCloudSync() {
    const returned = await GoogleDriveDisconnectDialogComponent.confirmDisconnection(this._dialog);
    if (!returned) return void 0;

    if (returned.deleteAllData) {
      await this._gdrive.deleteAllData();
    }
    return this._gdrive.disableSync(true);
  }

  private _updateCloudUi(state: DriveSyncState) {
    this.cloudIconDisabled = false;
    this.disconnectCloudDisabled = false;
    this.needsSync = false;
    this.needsConnectDialog = false;

    switch (state) {
      case DriveSyncState.DISCONNECTED:
        this.disconnectCloudDisabled = true;
        this.needsConnectDialog = true;
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
