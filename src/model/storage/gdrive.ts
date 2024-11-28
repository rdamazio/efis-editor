/// <reference types="@types/gapi.client.drive-v3" />
import { HttpStatusCode } from '@angular/common/http';
import { EventEmitter, Injectable } from '@angular/core';
import { BehaviorSubject, filter, firstValueFrom, Observable, Subject, takeUntil } from 'rxjs';
import { ChecklistFile } from '../../../gen/ts/checklist';
import { LazyBrowserStorage } from './browser-storage';
import { ChecklistStorage } from './checklist-storage';
import { GoogleDriveApi } from './gdrive-api';

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

type PostAuthFunction = () => Promise<void>;

/** Represents a local deletion. */
interface LocalDeletion {
  fileName: string;
  deletionTime: Date;
}

/** The structure that JSON.parse reads LocalDeletion objects in. */
interface LocalDeletionJson {
  fileName: string;
  deletionTime: string;
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
 * NEEDS_SYNC -> DISCONNECTED
 * or IN_SYNC -> DISCONNECTED
 * or  FAILED -> DISCONNECTED: If the user explicitly disconnects from Google Drive.
 *
 * Synchronization itself is based on filenames and modification times. Specifically:
 * - If a file only exists locally, it's uploaded
 * - If a file only exists remotely, it's downloaded
 * - If a file exists in both, and the remote is older, it's uploaded
 * - If a file exists in both, and the remote is newer, it's downloaded
 * - If a file exists in both, and mtime is the same, no action is taken
 * - If a file was deleted locally, it'll be moved to trash remotely
 * - If a file was trashed remotely, it'll be deleted locally
 *
 * An important caveat is that, if a file was modified both locally and remotely, it does
 * NOT merge the changes - the one that was modified most recently wins. Other caveats,
 * such as the fact that trashed file names disappear after 30 days, are documented
 * throughout the code.
 */
@Injectable({
  providedIn: 'root',
})
export class GoogleDriveStorage {
  public static readonly CHECKLIST_MIME_TYPE = 'application/vnd.damazio.efis-editor.checklist';
  public static readonly CHECKLIST_EXTENSION = '.checklist';
  public static readonly LONG_SYNC_INTERVAL_MS = 60_000;
  public static readonly SHORT_SYNC_INTERVAL_MS = 10_000;
  private static readonly TOKEN_STORAGE_KEY = 'gdrive_token';
  private static readonly LOCAL_DELETIONS_STORAGE_KEY = 'local_deletions';
  private static readonly MAX_RETRIES = 3;

  private readonly _browserStorage: Promise<Storage>;
  private readonly _state$ = new BehaviorSubject(DriveSyncState.DISCONNECTED);
  private readonly _downloads$ = new Subject<string>();
  private readonly _errors$ = new Subject<string>();
  private readonly _destroyed = new EventEmitter<void>();
  private _retryCount = 0;
  private _needsSync = false;
  private _lastChecklistList: string[] = [];
  private _syncInterval?: number;
  private _lastSync = new Date(0);

  constructor(
    private readonly _api: GoogleDriveApi,
    private readonly _checklistStorage: ChecklistStorage,
    lazyStorage: LazyBrowserStorage,
  ) {
    this._browserStorage = lazyStorage.storage;

    this._state$
      .asObservable()
      .pipe(takeUntil(this._destroyed))
      .subscribe((state: DriveSyncState) => {
        console.debug('SYNC: state ' + state.toString());
      });
  }

  public async init() {
    return Promise.all([this._api.load(), this._browserStorage]).then(async (all: [void, Storage]) => {
      console.debug('SYNC: gDrive API initialized');
      const store = all[1];
      const token = store.getItem(GoogleDriveStorage.TOKEN_STORAGE_KEY) ?? undefined;
      if (token) {
        this._api.accessToken = token;
      }

      return new Promise((resolve) => {
        let first = true;
        this._checklistStorage
          .listChecklistFiles()
          .pipe(takeUntil(this._destroyed))
          .subscribe((checklists: string[]) => {
            void this._onChecklistsUpdated(checklists).then(async () => {
              // The above will trigger the first _needsSync, but if we're connected, we force a first
              // immediate synchronization.
              if (first) {
                first = false;
                if (token) {
                  this._state$.next(DriveSyncState.NEEDS_SYNC);
                  await this.synchronize();
                }
                resolve(void 0);
              }
              return void 0;
            });
          });
      });
    });
  }

  public destroy() {
    this._stopBackgroundSync();
    this._destroyed.emit();
  }

  private async _authenticate(): Promise<void> {
    console.debug('SYNC: auth start');
    const apiAuth = this._api.authenticate().catch((error: google.accounts.oauth2.ClientConfigError) => {
      console.debug('SYNC: auth failed', error);
      if (error.type === 'popup_failed_to_open') {
        this._errors$.next('Failed to open popup to refresh Google Drive auth token - are popups blocked?');
      } else if (error.type === 'popup_closed') {
        this._errors$.next('Google Drive authentication cancelled - synchronization disabled.');
        void this.disableSync(false);
      } else {
        this._errors$.next('Google Drive authentication failed: ' + error.message);
      }
      return '';
    });

    return Promise.all([this._browserStorage, apiAuth]).then(([store, token]: [Storage, string]) => {
      if (!token) {
        throw new Error('Auth success but token missing?');
      }

      store.setItem(GoogleDriveStorage.TOKEN_STORAGE_KEY, token);

      // Do a first synchronization with this token.
      this._state$.next(DriveSyncState.NEEDS_SYNC);
      return void 0;
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async _handleRequestFailure(retryFunc: PostAuthFunction, reason: gapi.client.Response<any>) {
    console.debug(`SYNC: failed. retries=${this._retryCount}, reason`, reason);
    this._retryCount++;

    if (reason.status === HttpStatusCode.Unauthorized || reason.status === HttpStatusCode.Forbidden) {
      console.debug('SYNC: Refreshing token');
      this._api.accessToken = undefined;

      if (this._retryCount < GoogleDriveStorage.MAX_RETRIES) {
        this._state$.next(DriveSyncState.DISCONNECTED);
        return this._authenticate().then(retryFunc);
      } else {
        this._state$.next(DriveSyncState.FAILED);
        const errorTxt = `Google Drive synchronization failed after ${this._retryCount} retries.`;
        this._errors$.next(errorTxt);
        throw new Error(errorTxt);
      }
    } else {
      this._state$.next(DriveSyncState.FAILED);
      throw new Error('gDrive request failed with status ' + reason.status);
    }
  }

  public async deleteAllData(): Promise<void> {
    this._stopBackgroundSync();

    // Wait until we're not syncing anymore.
    await firstValueFrom(this._state$.asObservable().pipe(filter((state) => state !== DriveSyncState.SYNCING)), {
      defaultValue: DriveSyncState.DISCONNECTED,
    });

    const existingFiles = await this._api.listFiles({
      mimeType: GoogleDriveStorage.CHECKLIST_MIME_TYPE,
    });

    const ops: Promise<void>[] = [];
    // TODO: Consider using batching: https://developers.google.com/drive/api/guides/performance#batch-requests
    for (const file of existingFiles) {
      if (!file.id) continue;

      console.debug(`SYNC: Deleting remote file ${file.name}`);
      // If user asked to delete their data, use actual deletion rather than moving to the trash.
      ops.push(this._api.deleteFile(file.id));
    }
    return Promise.all(ops)
      .then(() => void 0)
      .catch(this._handleRequestFailure.bind(this, this.deleteAllData.bind(this)));
  }

  public async disableSync(revokeToken: boolean) {
    console.debug('SYNC: Disabling');

    this._stopBackgroundSync();

    // Get rid of the token immediately - worst case, if revoking it fails, we'll still be disconnected.
    (await this._browserStorage).removeItem(GoogleDriveStorage.TOKEN_STORAGE_KEY);

    if (revokeToken) {
      await this._api.revokeAccessToken();
    } else {
      this._api.accessToken = undefined;
    }

    // Transition to disconnected only after the token is discarded above so
    // there's no chance it'll be used for another sync.
    this._state$.next(DriveSyncState.DISCONNECTED);
  }

  public async synchronize() {
    if (this._state$.value === DriveSyncState.SYNCING) {
      console.error('SYNC: overlapping syncs');
      return;
    }
    if (this._state$.value === DriveSyncState.DISCONNECTED) {
      return this._authenticate().then(async (): Promise<void> => {
        return this.synchronize();
      });
    }

    console.debug('SYNC START');
    this._state$.next(DriveSyncState.SYNCING);
    this._lastSync = new Date();
    this._stopBackgroundSync();

    // Any change that comes in after we're already syncing may not get uploaded this time,
    // so clear the flag early. This may result in more syncs than needed.
    this._needsSync = false;

    // List remote checklists.
    const remoteFiles = this._api
      .listFiles({
        mimeType: GoogleDriveStorage.CHECKLIST_MIME_TYPE,
        fields: 'files(id, name, modifiedTime, mimeType, trashed)',
        // This ensures that, if a name collision happens, we take the latest one into account.
        orderBy: 'modifiedTime',
      })
      .then((existingFiles: gapi.client.drive.File[]) => {
        console.debug('SYNC: LIST', existingFiles);

        // Map from file names to gDrive file IDs.
        const remoteFileMap = new Map<string, gapi.client.drive.File>();
        for (const file of existingFiles) {
          let name = file.name;
          if (!name || !file.id) continue;

          // Remove checklist extension to get original name.
          if (name.endsWith(GoogleDriveStorage.CHECKLIST_EXTENSION)) {
            name = name.slice(0, -GoogleDriveStorage.CHECKLIST_EXTENSION.length);
          }

          if (remoteFileMap.has(name)) {
            // gDrive does allow multiple files with the same name (plus, it's possible that a file was trashed then re-created).
            // The list will be ordered by modified time, so the map will keep the latest one.
            console.error(
              `Name collision for "${name}": previous ID "${remoteFileMap.get(name)?.id}", new ID "${file.id}"`,
            );
          }
          remoteFileMap.set(name, file);
        }
        return remoteFileMap;
      });
    // List local checklists.
    const localChecklists = firstValueFrom(this._checklistStorage.listChecklistFiles(), { defaultValue: [] });
    const localDeletions = this._getLocalDeletions();

    // Actually perform synchronization.
    const syncOps = Promise.all([remoteFiles, localChecklists, localDeletions]).then(
      async ([remoteFileMap, localChecklistNames, localDeletions]: [
        Map<string, gapi.client.drive.File>,
        string[],
        LocalDeletion[],
      ]) => {
        const syncOperations: Promise<void>[] = [];

        // Synchronize files that were deleted locally.
        // We first filter the list of which ones we'll really delete, since in corner cases
        // we may want to download them instead.
        localDeletions = localDeletions.filter((deletion: LocalDeletion) => {
          const remoteFile = remoteFileMap.get(deletion.fileName);
          return this._filterLocalDeletion(deletion, localChecklistNames, remoteFile);
        });
        for (const deletion of localDeletions) {
          const remoteFile = remoteFileMap.get(deletion.fileName);
          if (!remoteFile?.id) continue;

          syncOperations.push(this._api.trashFile(remoteFile.id));
        }

        // Synchronize all local checklists (including ones that also exist remotely).
        for (const name of localChecklistNames) {
          const remoteFile = remoteFileMap.get(name);
          syncOperations.push(this._synchronizeLocalFile(name, remoteFile));
        }

        // Synchronize checklists that only exist on the remote.
        for (const [name, remoteFile] of remoteFileMap.entries()) {
          // If it also exists locally, it was already synchronized above.
          if (localChecklistNames.includes(name)) continue;

          // If we started to deleted it above, skip.
          if (localDeletions.find((d: LocalDeletion) => d.fileName === name)) continue;

          syncOperations.push(this._downloadFile(remoteFile));
        }

        return Promise.all(syncOperations);
      },
    );
    return syncOps
      .then(async () => {
        await this._setLocalDeletions([]);
        this._retryCount = 0;

        // It's possible that new changes came in while we were syncing - set the next state accordingly.
        this._state$.next(this._needsSync ? DriveSyncState.NEEDS_SYNC : DriveSyncState.IN_SYNC);

        this._startBackgroundSync();
        console.debug('SYNC: Cleanup done');
        return void 0;
      })
      .catch(this._handleRequestFailure.bind(this, this.synchronize.bind(this)));
  }

  private _filterLocalDeletion(
    deletion: LocalDeletion,
    localChecklistNames: string[],
    remoteFile?: gapi.client.drive.File,
  ): boolean {
    // File was already not on gDrive.
    if (!remoteFile?.id) {
      console.debug(`SYNC: Not deleting remote file '${deletion.fileName}' - not on Drive`);
      return false;
    }
    // File was already trashed.
    if (remoteFile.trashed) {
      console.debug(`SYNC: Not deleting remote file '${deletion.fileName}' - already trashed`);
      return false;
    }
    // Another local checklist with the same name was created since the deletion?
    if (localChecklistNames.includes(deletion.fileName)) {
      console.debug(`SYNC: Not deleting remote file '${deletion.fileName}' - recreated locally`);
      return false;
    }

    // If the file was written after the local deletion, keep what was written (it'll be downloaded again).
    let remoteModifiedTime: Date | undefined;
    if (remoteFile.modifiedTime) {
      remoteModifiedTime = new Date(remoteFile.modifiedTime);
    }
    if (!remoteModifiedTime || remoteModifiedTime >= deletion.deletionTime) {
      console.debug(`SYNC: Not deleting remote file '${deletion.fileName}' - remote file is newer than deletion.`);
      return false;
    }

    console.debug(`SYNC: Deleting remote checklist '${deletion.fileName}'`);
    return true;
  }

  private async _synchronizeLocalFile(name: string, remoteFile?: gapi.client.drive.File): Promise<void> {
    const checklist = await this._checklistStorage.getChecklistFile(name);
    if (!checklist) return;

    const localModifiedTime: Date = new Date(checklist.metadata!.modifiedTime * 1000);
    let remoteModifiedTime: Date | undefined;
    if (remoteFile?.modifiedTime) {
      remoteModifiedTime = new Date(remoteFile.modifiedTime);
    }
    const remoteId = remoteFile?.id;

    // Local version is newer (or the only one).
    // This includes the case where the remote file was trashed but it was recreated locally.
    if (!remoteModifiedTime || !remoteId || localModifiedTime > remoteModifiedTime) {
      console.debug(`SYNC: Uploading file '${name}'.`);

      // To avoid synchronization confusion, drop the mtime from the uploaded JSON.
      const uploadedChecklist = ChecklistFile.clone(checklist);
      uploadedChecklist.metadata!.modifiedTime = 0;

      return this._api.uploadFile(
        name + GoogleDriveStorage.CHECKLIST_EXTENSION,
        remoteId,
        GoogleDriveStorage.CHECKLIST_MIME_TYPE,
        localModifiedTime,
        ChecklistFile.toJsonString(uploadedChecklist),
      );
    }

    // Remote version is newer.
    if (localModifiedTime < remoteModifiedTime) {
      // Upstream is authoritative (whether deleted or just updated).
      if (remoteFile.trashed) {
        console.debug(`SYNC: Deleting local file '${name}'.`);
        return this._checklistStorage.deleteChecklistFile(name);
      } else {
        return this._downloadFile(remoteFile);
      }
    }

    // The remote existed but had the same mtime as the local version - do nothing.
    console.debug(`SYNC: File '${name}' was already in sync.`);
    return;
  }

  private async _downloadFile(remoteFile: gapi.client.drive.File): Promise<void> {
    if (remoteFile.trashed) {
      console.debug(`SYNC: Not downloading trashed file '${remoteFile.name}'`);
      return;
    }

    console.debug(`SYNC: Downloading file '${remoteFile.name}'.`);
    const fileId = remoteFile.id!;

    let modifiedTime: Date | undefined;
    if (remoteFile.modifiedTime) {
      modifiedTime = new Date(remoteFile.modifiedTime);
    }

    return this._api.downloadFile(fileId).then(async (fileContents: string): Promise<void> => {
      const checklist = ChecklistFile.fromJsonString(fileContents);
      if (checklist.metadata?.name + GoogleDriveStorage.CHECKLIST_EXTENSION !== remoteFile.name) {
        console.warn(
          `SYNC: potential name mismatch '${remoteFile.name}' vs '${checklist.metadata?.name}' (file ID '${fileId}')`,
        );
      }
      return this._checklistStorage.saveChecklistFile(checklist, modifiedTime).then(() => {
        // Let the UI know that our local data has changed
        this._downloads$.next(checklist.metadata!.name);
        return void 0;
      });
    });
  }

  private _startBackgroundSync() {
    if (this._syncInterval) {
      console.error('SYNC: Background sync already running');
      return;
    }

    this._syncInterval = window.setInterval(() => {
      // Synchronize if there are local changes, or if it's been a while (to pull remote changes).
      const now = new Date();
      const msSinceLastSync = now.valueOf() - this._lastSync.valueOf();
      console.debug(`SYNC TIMER: needed=${this._needsSync}, sinceLast=${msSinceLastSync}ms`);
      if (this._needsSync || msSinceLastSync >= GoogleDriveStorage.LONG_SYNC_INTERVAL_MS) {
        void this.synchronize();
      }
    }, GoogleDriveStorage.SHORT_SYNC_INTERVAL_MS);
  }

  private _stopBackgroundSync() {
    if (this._syncInterval !== undefined) {
      window.clearInterval(this._syncInterval);
      this._syncInterval = undefined;
    }
  }

  private async _getLocalDeletions(): Promise<LocalDeletion[]> {
    const store = await this._browserStorage;
    const deletionsJson = store.getItem(GoogleDriveStorage.LOCAL_DELETIONS_STORAGE_KEY);
    if (!deletionsJson) return [];

    // While JSON.stringify below properly serializes dates, JSON.parse does not parse them back.
    const parsedDeletions = JSON.parse(deletionsJson) as LocalDeletionJson[];
    return parsedDeletions.map((d: LocalDeletionJson): LocalDeletion => {
      return {
        fileName: d.fileName,
        deletionTime: new Date(d.deletionTime),
      };
    });
  }

  private async _setLocalDeletions(deletions: LocalDeletion[]) {
    const store = await this._browserStorage;
    store.setItem(GoogleDriveStorage.LOCAL_DELETIONS_STORAGE_KEY, JSON.stringify(deletions));
  }

  private async _onChecklistsUpdated(checklists: string[]) {
    // Detect newly deleted checklists.
    const newlyDeletedNames = this._lastChecklistList.filter((x) => !checklists.includes(x));
    const localDeletions: LocalDeletion[] = newlyDeletedNames.map((name: string): LocalDeletion => {
      console.debug(`SYNC: Detected deletion of '${name}'`);
      return { fileName: name, deletionTime: new Date() };
    });

    this._lastChecklistList = Array.from(checklists);

    // Merge it with previously-known deletions.
    const previousDeletions = await this._getLocalDeletions();
    console.debug(`SYNC: Previous deletions: '${JSON.stringify(previousDeletions)}'`);
    const previousDeletionsToKeep = previousDeletions.filter((deletion: LocalDeletion) => {
      // If it was also deleted again just now, keep the newer one.
      return !newlyDeletedNames.includes(deletion.fileName);
    });
    localDeletions.push(...previousDeletionsToKeep);
    await this._setLocalDeletions(localDeletions);

    console.debug(`SYNC: needed, deletions=${JSON.stringify(localDeletions)}`);
    this._needsSync = true;
    if (this._state$.value === DriveSyncState.IN_SYNC) {
      this._state$.next(DriveSyncState.NEEDS_SYNC);
    }
  }

  public getState(): Observable<DriveSyncState> {
    return this._state$.asObservable();
  }

  public onDownloads(): Observable<string> {
    return this._downloads$.asObservable();
  }

  public onErrors(): Observable<string> {
    return this._errors$.asObservable();
  }
}
