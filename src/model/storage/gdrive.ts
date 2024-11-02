/// <reference types="@types/gapi.client.drive-v3" />
/// <reference types="@types/google.accounts"/>
import { HttpStatusCode } from '@angular/common/http';
import { afterNextRender, Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom, Observable } from 'rxjs';
import { LazyBrowserStorage } from './browser-storage';
import { ChecklistStorage } from './checklist-storage';

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
 * Application data files are not visible to users (even their owners) - they
 * can only see how much space it's taking, and choose to delete it or
 * disconnect the app.
 * Checklist files are identified by their custom MIME type, and receive a '.checklist'
 * extension.
 *
 * Internally, this works as a state machine with the following state transitions:
 * DISCONNECTED -> NEEDS_SYNC: When the user connects to Google Drive and we've obtained
 *                             an access token, or at startup if a token is already known.
 * IN_SYNC -> NEEDS_SYNC: When new local changes are made after the first sync.
 * NEEDS_SYNC -> SYNCING: When synchronization starts due to local changes. By default,
 *                        local-change sync happens every 10 seconds.
 * SYNCING -> IN_SYNC: When synchronization completes successfully.
 * SYNCING -> FAILED: When synchronization has failed.
 * SYNCING -> DISCONNECTED: If access issues are detected, we try to obtain an updated
 *                          access token immediately, retrying up to 3 times.
 * IN_SYNC -> SYNCING: Periodic synchronization (every 60 seconds) happens even if no local
 *                     changes were made, to ensure remote changes are downloaded.
 */
@Injectable({
  providedIn: 'root',
})
export class GoogleDriveStorage {
  private static readonly TOKEN_STORAGE_KEY = 'gdrive_token';
  // eslint-disable-next-line no-secrets/no-secrets
  private static readonly CLIENT_ID = '561910372899-o32ockiiaiv1elinrfvcnfelashd0ctl.apps.googleusercontent.com';
  private static readonly API_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
  private static readonly LONG_SYNC_INTERVAL_MS = 60_000;
  private static readonly SHORT_SYNC_INTERVAL_MS = 10_000;
  private static readonly MAX_RETRIES = 3;

  private readonly _browserStorage: Promise<Storage>;
  private readonly _stateSubject = new BehaviorSubject<DriveSyncState>(DriveSyncState.DISCONNECTED);
  private _retryCount = 0;
  private _token?: string;
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
    const apiLoad = Promise.all([
      this._loadScript('https://accounts.google.com/gsi/client'),
      this._loadScript('https://apis.google.com/js/api.js'),
    ])
      .then(async () => {
        return new Promise<void>((resolve) => {
          gapi.load('client', () => {
            resolve();
          });
        });
      })
      .then(async () => {
        await gapi.client.load('https://www.googleapis.com/discovery/v1/apis/drive/v3/rest');
        return void 0;
      });

    return Promise.all([
      apiLoad,
      this._browserStorage,
      firstValueFrom(this._checklistStorage.listChecklistFiles()),
    ]).then((all: [void, Storage, string[]]) => {
      console.debug('SYNC: gDrive API initialized');
      const store = all[1];
      this._token = store.getItem(GoogleDriveStorage.TOKEN_STORAGE_KEY) ?? undefined;
      this._checklistStorage.listChecklistFiles().subscribe(this._onChecklistsUpdated.bind(this));

      if (this._token) {
        this._stateSubject.next(DriveSyncState.NEEDS_SYNC);
        this.synchronize();
      }
      return void 0;
    });
  }
  private async _loadScript(src: string): Promise<void> {
    return new Promise<void>(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => {
        resolve();
      };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  private _authenticate() {
    console.debug('SYNC: auth start');

    // Based on https://developers.google.com/identity/oauth2/web/guides/use-token-model
    // TODO: Do we need to switch to authorization code model so we don't get frequent refresh popups
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GoogleDriveStorage.CLIENT_ID,
      scope: GoogleDriveStorage.API_SCOPE,
      include_granted_scopes: true,
      prompt: '',
      callback: (resp: google.accounts.oauth2.TokenResponse) => {
        if (!resp.access_token) {
          console.error('Failed to get access token: ', resp);
          return;
        }

        console.debug('SYNC: auth complete');

        void this._browserStorage.then((store: Storage) => {
          this._token = resp.access_token;
          store.setItem(GoogleDriveStorage.TOKEN_STORAGE_KEY, this._token);

          // Do a first synchronization with this token.
          this._stateSubject.next(DriveSyncState.NEEDS_SYNC);
          this.synchronize();
          return void 0;
        });
      },
    });
    client.requestAccessToken();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _handleRequestFailure(reason: gapi.client.Response<any>) {
    this._retryCount++;

    if (reason.status === HttpStatusCode.Unauthorized || reason.status === HttpStatusCode.Forbidden) {
      console.debug('SYNC: Refreshing token');
      this._token = undefined;

      if (this._retryCount < GoogleDriveStorage.MAX_RETRIES) {
        this._stateSubject.next(DriveSyncState.DISCONNECTED);
        this._authenticate();
      } else {
        this._stateSubject.next(DriveSyncState.FAILED);
      }
    } else {
      this._stateSubject.next(DriveSyncState.FAILED);
      console.error('Request failed: ', reason);
      throw new Error('gDrive request failed with status ' + reason.status);
    }
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
