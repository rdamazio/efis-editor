import { BehaviorSubject, firstValueFrom, Observable } from 'rxjs';
import { ChecklistStorage } from './checklist-storage';
import { LazyBrowserStorage } from './browser-storage';
import { afterNextRender, Injectable } from '@angular/core';

export enum DriveSyncState {
  // User has not enabled synchronization to Google Drive.
  DISCONNECTED = 0,

  // There are local changes to be synchronized, and they're not being synchronized yet.
  NEEDS_SYNC = 1,

  // Synchronization is ongoing.
  SYNCING = 2,

  // Synchronization has completed recently, and no local changes have happened since.
  // There may still be unsynchronized remote changes that the next synchronization will bring in.
  IN_SYNC = 3,

  // Synchronization has failed and will not be re-attempted automatically.
  FAILED = 4,
}

/**
 * Service to synchronize storage to Google Drive as application data.
 *
 * Internally, this works as a state machine with the following state transitions:
 * DISCONNECTED -> NEEDS_SYNC: When the user connects to Google Drive and we've obtained
 *                             an access token, or at startup if a token is already known.
 * IN_SYNC -> NEEDS_SYNC: When new local changes are made after the first sync.
 * NEEDS_SYNC -> SYNCING: When synchronization starts due to local changes. By default,
 *                        local-change sync happens every 10 seconds.
 * SYNCING -> IN_SYNC: When synchronization completes successfully.
 * SYNCING -> DISCONNECTED: If access issues are detected, we try to obtain an updated
 *                          access token immediately, retrying up to 3 times.
 * IN_SYNC -> SYNCING: Periodic synchronization (every 60 seconds) happens even if no local
 *                     changes were made, to ensure remote changes are downloaded.
 */
@Injectable({
  providedIn: 'root',
})
export class GoogleDriveStorage {
  private static readonly LONG_SYNC_INTERVAL_MS = 60_000;
  private static readonly SHORT_SYNC_INTERVAL_MS = 10_000;
  private static readonly MAX_RETRIES = 3;

  private readonly _browserStorage: Promise<Storage>;
  private readonly _stateSubject = new BehaviorSubject<DriveSyncState>(DriveSyncState.DISCONNECTED);
  private _retryCount = 0;
  private _needsSync = false;
  private _syncInterval?: number;
  private _lastSync = new Date();

  constructor(
    private readonly _checklistStorage: ChecklistStorage,
    lazyStorage: LazyBrowserStorage,
  ) {
    this._browserStorage = lazyStorage.storage;

    afterNextRender({
      write: () => {
        void this._initApi();
      },
    });
    this._stateSubject.asObservable().subscribe((state: DriveSyncState) => {
      console.debug('SYNC: state ' + state.toString());
    });
  }

  private async _initApi() {
    return Promise.all([this._browserStorage, firstValueFrom(this._checklistStorage.listChecklistFiles())]).then(() => {
      this._checklistStorage.listChecklistFiles().subscribe(this._onChecklistsUpdated.bind(this));
      this._stateSubject.next(DriveSyncState.NEEDS_SYNC);
      this.synchronize();
      return void 0;
    });
  }

  private _authenticate() {
    // TODO
  }

  public synchronize() {
    if (this._stateSubject.value === DriveSyncState.SYNCING) {
      console.error('SYNC: overlapping syncs');
      return;
    }
    if (this._stateSubject.value === DriveSyncState.DISCONNECTED) {
      this._authenticate();
      return;
    }

    console.debug('SYNC START');
    this._stateSubject.next(DriveSyncState.SYNCING);
    this._lastSync = new Date();
    this._stopBackgroundSync();

    // Any change that comes in after we're already syncing may not get uploaded this time,
    // so clear the flag early. This may result in more syncs than needed.
    this._needsSync = false;

    // TODO: Actually perform synchronization.

    this._stateSubject.next(DriveSyncState.IN_SYNC);
    this._retryCount = 0;
    this._startBackgroundSync();
    return void 0;
  }

  private _startBackgroundSync() {
    if (this._syncInterval) {
      console.error('SYNC: Background sync already running');
      return;
    }

    this._syncInterval = window.setInterval(() => {
      console.debug(`SYNC TIMER: needed=${this._needsSync}`);

      // Synchronize if there are local changes, or if it's been a while (to pull remote changes).
      const now = new Date();
      const msSinceLastSync = now.valueOf() - this._lastSync.valueOf();
      if (this._needsSync || msSinceLastSync > GoogleDriveStorage.LONG_SYNC_INTERVAL_MS) {
        this.synchronize();
      }
    }, GoogleDriveStorage.SHORT_SYNC_INTERVAL_MS);
  }

  private _stopBackgroundSync() {
    if (this._syncInterval !== undefined) {
      window.clearInterval(this._syncInterval);
      this._syncInterval = undefined;
    }
  }

  private _onChecklistsUpdated() {
    this._needsSync = true;
    if (this._stateSubject.value === DriveSyncState.IN_SYNC) {
      this._stateSubject.next(DriveSyncState.NEEDS_SYNC);
    }

    console.debug(`SYNC: needed`);
  }

  public getState(): Observable<DriveSyncState> {
    return this._stateSubject.asObservable();
  }
}
