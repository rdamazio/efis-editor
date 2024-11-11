import { ChangeDetectorRef, Component, HostListener, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { SwalComponent, SwalPortalTargets, SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';
import { firstValueFrom } from 'rxjs';
import { DriveSyncState, GoogleDriveStorage } from '../../model/storage/gdrive';

@Component({
  selector: 'gdrive-nav',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatSnackBarModule, MatTooltipModule, SweetAlert2Module],
  templateUrl: './gdrive.component.html',
  styleUrl: './gdrive.component.scss',
})
@UntilDestroy()
export class GoogleDriveComponent {
  @ViewChild('cloudSyncSwal')
  public readonly syncSwal!: SwalComponent;

  cloudIconDisabled = false;
  disconnectCloudDisabled = true;
  needsSync = false;
  cloudIcon = '';
  cloudIconTooltip = '';

  constructor(
    protected readonly swalTargets: SwalPortalTargets,
    private readonly _snackBar: MatSnackBar,
    private readonly _gdrive: GoogleDriveStorage,
    private readonly _changeDet: ChangeDetectorRef,
  ) {
    this._gdrive.getState().pipe(untilDestroyed(this)).subscribe(this._updateCloudUi.bind(this));
    this._gdrive.onErrors().pipe(untilDestroyed(this)).subscribe(this._onSyncError.bind(this));
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
