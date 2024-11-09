/// <reference types="@types/gapi.client.drive-v3" />
/// <reference types="@types/google.accounts"/>
import { HttpStatusCode } from '@angular/common/http';
import { afterNextRender, Injectable } from '@angular/core';
import { BehaviorSubject, filter, firstValueFrom, Observable } from 'rxjs';
import { ChecklistFile } from '../../../gen/ts/checklist';
import { LazyBrowserStorage } from './browser-storage';
import { ChecklistStorage } from './checklist-storage';
import { MultipartEncoder } from './multipart';

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
  private static readonly TOKEN_STORAGE_KEY = 'gdrive_token';
  private static readonly UPLOAD_API_PATH = '/upload/drive/v3/files';
  // eslint-disable-next-line no-secrets/no-secrets
  private static readonly CLIENT_ID = '561910372899-o32ockiiaiv1elinrfvcnfelashd0ctl.apps.googleusercontent.com';
  private static readonly API_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
  private static readonly CHECKLIST_MIME_TYPE = 'application/vnd.damazio.efis-editor.checklist';
  private static readonly CHECKLIST_EXTENSION = '.checklist';
  private static readonly LONG_SYNC_INTERVAL_MS = 60_000;
  private static readonly SHORT_SYNC_INTERVAL_MS = 10_000;
  private static readonly MAX_RETRIES = 3;

  private readonly _browserStorage: Promise<Storage>;
  private readonly _stateSubject = new BehaviorSubject<DriveSyncState>(DriveSyncState.DISCONNECTED);
  private _retryCount = 0;
  private _token?: string;
  private _needsSync = false;
  private _lastChecklistList: string[] = [];
  private _pendingDeletions: string[] = [];
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
        void this.synchronize();
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

  private _authenticate(nextStep: PostAuthFunction) {
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

        void this._browserStorage.then(async (store: Storage) => {
          this._token = resp.access_token;
          store.setItem(GoogleDriveStorage.TOKEN_STORAGE_KEY, this._token);

          // Do a first synchronization with this token.
          this._stateSubject.next(DriveSyncState.NEEDS_SYNC);
          return nextStep();
        });
      },
    });
    client.requestAccessToken();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _handleRequestFailure(retryFunc: PostAuthFunction, reason: gapi.client.Response<any>) {
    this._retryCount++;

    if (reason.status === HttpStatusCode.Unauthorized || reason.status === HttpStatusCode.Forbidden) {
      console.debug('SYNC: Refreshing token');
      this._token = undefined;

      if (this._retryCount < GoogleDriveStorage.MAX_RETRIES) {
        this._stateSubject.next(DriveSyncState.DISCONNECTED);
        this._authenticate(retryFunc);
      } else {
        this._stateSubject.next(DriveSyncState.FAILED);
      }
    } else {
      this._stateSubject.next(DriveSyncState.FAILED);
      console.error('Request failed: ', reason);
      throw new Error('gDrive request failed with status ' + reason.status);
    }
  }

  public async deleteAllData(): Promise<void> {
    this._stopBackgroundSync();

    // Wait until we're not syncing anymore.
    await firstValueFrom(this._stateSubject.asObservable().pipe(filter((state) => state !== DriveSyncState.SYNCING)));

    const existingFiles = await this._listFiles(GoogleDriveStorage.CHECKLIST_MIME_TYPE);

    const ops: Promise<gapi.client.Response<void>>[] = [];
    // TODO: Consider using batching: https://developers.google.com/drive/api/guides/performance#batch-requests
    for (const file of existingFiles) {
      if (!file.id) continue;

      console.debug(`SYNC: Deleting remote file ${file.name}`);
      // If user asked to delete their data, use actual deletion rather than moving to the trash.
      ops.push(gapi.client.drive.files.delete({ fileId: file.id }));
    }
    return Promise.all(ops)
      .then(() => void 0)
      .catch(this._handleRequestFailure.bind(this, this.deleteAllData.bind(this)));
  }

  public async disableSync() {
    if (!this._token) return;
    console.debug('SYNC: Disabling');

    this._stopBackgroundSync();

    // Get rid of the token immediately - worst case, if revoking it fails, we'll still be disconnected.
    const oldToken = this._token;
    this._token = undefined;
    (await this._browserStorage).removeItem(GoogleDriveStorage.TOKEN_STORAGE_KEY);

    // Transition to disconnected only after the token is discarded above so
    // there's no chance it'll be used for another sync.
    this._stateSubject.next(DriveSyncState.DISCONNECTED);

    return new Promise<void>((resolve) => {
      google.accounts.oauth2.revoke(oldToken, resolve);
    });
  }

  public async synchronize() {
    if (this._stateSubject.value === DriveSyncState.SYNCING) {
      console.error('SYNC: overlapping syncs');
      return;
    }
    if (this._stateSubject.value === DriveSyncState.DISCONNECTED) {
      this._authenticate(this.synchronize.bind(this));
      return;
    }

    console.debug('SYNC START');
    this._stateSubject.next(DriveSyncState.SYNCING);
    this._lastSync = new Date();
    this._stopBackgroundSync();

    // Any change that comes in after we're already syncing may not get uploaded this time,
    // so clear the flag early. This may result in more syncs than needed.
    this._needsSync = false;

    // List remote checklists.
    const remoteFiles = this._listFiles(GoogleDriveStorage.CHECKLIST_MIME_TYPE).then(
      (existingFiles: gapi.client.drive.File[]) => {
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
      },
    );
    // List local checklists.
    const localChecklists = firstValueFrom(this._checklistStorage.listChecklistFiles());

    // Actually perform synchronization.
    const syncOps = Promise.all([remoteFiles, localChecklists]).then(
      async ([remoteFileMap, localChecklistNames]: [Map<string, gapi.client.drive.File>, string[]]) => {
        const syncOperations: Promise<void>[] = [];

        // Synchronize files that were deleted locally.
        if (this._pendingDeletions.length) {
          console.debug(`SYNC: Deleting remote checklists [${this._pendingDeletions.toString()}]`);
        }
        for (const name of this._pendingDeletions) {
          const remoteFile = remoteFileMap.get(name);
          syncOperations.push(this._synchronizeLocalDeletion(name, localChecklistNames, remoteFile));
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

          syncOperations.push(this._downloadFile(remoteFile));
        }

        return Promise.all(syncOperations);
      },
    );
    return syncOps
      .then(() => {
        this._pendingDeletions = [];
        this._stateSubject.next(DriveSyncState.IN_SYNC);
        this._retryCount = 0;
        this._startBackgroundSync();
        return void 0;
      })
      .catch(this._handleRequestFailure.bind(this, this.synchronize.bind(this)));
  }

  private async _synchronizeLocalDeletion(
    name: string,
    localChecklistNames: string[],
    remoteFile?: gapi.client.drive.File,
  ): Promise<void> {
    // File was already not on gDrive.
    if (!remoteFile?.id) {
      console.debug(`SYNC: Not deleting remote file '${name}' - not on Drive`);
      return;
    }
    // File was already trashed.
    if (remoteFile.trashed) {
      console.debug(`SYNC: Not deleting remote file '${name}' - already trashed`);
      return;
    }
    // Another local checklist with the same name was created since the deletion?
    if (localChecklistNames.includes(name)) {
      console.debug(`SYNC: Not deleting remote file '${name}' - recreated locally`);
      return;
    }

    console.debug(`SYNC: Deleting remote checklist '${name}'`);
    return this._trashFile(remoteFile.id);
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
      return this._uploadFile(
        name + GoogleDriveStorage.CHECKLIST_EXTENSION,
        remoteId,
        GoogleDriveStorage.CHECKLIST_MIME_TYPE,
        localModifiedTime,
        ChecklistFile.toJsonString(checklist),
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

  private async _listFiles(mimeType: string): Promise<gapi.client.drive.File[]> {
    const files: gapi.client.drive.File[] = [];
    let nextPageToken: string | undefined;
    do {
      // eslint-disable-next-line no-await-in-loop
      const fileList = await gapi.client.drive.files
        .list({
          // oauth_token: this._token,
          spaces: 'appDataFolder',
          q: `mimeType = '${mimeType}'`,
          fields: 'nextPageToken, files(id, name, modifiedTime, mimeType, trashed)',
          // This ensures that, if a name collision happens, we take the latest one into account.
          orderBy: 'modifiedTime',
          pageToken: nextPageToken,
        })
        .then((resp: gapi.client.Response<gapi.client.drive.FileList>) => {
          console.debug('SYNC: LIST', resp);
          nextPageToken = resp.result.nextPageToken;
          return resp.result.files;
        });
      if (fileList) {
        files.push(...fileList);
      }
    } while (nextPageToken);

    return files;
  }

  private async _downloadFile(remoteFile: gapi.client.drive.File): Promise<void> {
    const fileId = remoteFile.id!;

    let modifiedTime: Date | undefined;
    if (remoteFile.modifiedTime) {
      modifiedTime = new Date(remoteFile.modifiedTime);
    }

    console.debug(`SYNC: Downloading file '${remoteFile.name}'.`);
    return gapi.client.drive.files
      .get({
        fileId: fileId,
        alt: 'media',
      })
      .then(async (response: gapi.client.Response<gapi.client.drive.File>) => {
        const fileContents = response.body;

        const checklist = ChecklistFile.fromJsonString(fileContents);
        if (checklist.metadata?.name + GoogleDriveStorage.CHECKLIST_EXTENSION !== remoteFile.name) {
          console.warn(
            `SYNC: potential name mismatch '${remoteFile.name}' vs '${checklist.metadata?.name}' (file ID '${fileId}')`,
          );
        }
        return this._checklistStorage.saveChecklistFile(checklist, modifiedTime);
        // TODO: If the current checklist was overwritten by a download, reload it.
      });
  }

  private async _uploadFile(
    name: string,
    existingId: string | undefined,
    mimeType: string,
    mtime: Date,
    contents: string,
  ) {
    if (!existingId) {
      existingId = await gapi.client.drive.files
        .create({
          resource: {
            name: name,
            mimeType: mimeType,
            // Set a modified time in the past so that, if the upload step fails, we try to upload
            // again (instead of keeping the create time which may be newer than the file's local
            // mtime, and would result in us downloading it).
            modifiedTime: '1970-01-01T00:00:00Z',
            parents: ['appDataFolder'],
          },
        })
        .then((resp: gapi.client.Response<gapi.client.drive.File>) => {
          console.debug('SYNC: Created file', resp);
          return resp.result.id;
        });
    }

    // We have to use multipart upload so the modified time is kept.
    const metadata: gapi.client.drive.File = {
      modifiedTime: mtime.toISOString(),
      // If file was previously trashed and we're re-uploading it, take it out of the trash.
      trashed: false,
    };

    const multipart = new MultipartEncoder();
    multipart.addPart(JSON.stringify(metadata), { mimeType: 'application/json' });
    multipart.addPart(contents, { mimeType: mimeType, base64encode: true });

    const uploaded = await gapi.client.request({
      path: GoogleDriveStorage.UPLOAD_API_PATH + '/' + existingId,
      method: 'PATCH',
      headers: {
        'Content-Type': multipart.contentType(),
      },
      params: {
        // We don't need any result fields.
        fields: '',
        uploadType: 'multipart',
      },
      body: multipart.finish(),
    });
    console.debug('SYNC: UPLOAD', uploaded);
  }

  private async _trashFile(id: string) {
    await gapi.client.drive.files.update({
      fileId: id,
      resource: {
        trashed: true,
      },
    });
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

  private _onChecklistsUpdated(checklists: string[]) {
    this._needsSync = true;
    if (this._stateSubject.value === DriveSyncState.IN_SYNC) {
      this._stateSubject.next(DriveSyncState.NEEDS_SYNC);
    }

    // Detect newly deleted checklists.
    // TODO: Keep track of local deletions using browser storage so it's not lost if user reloads before a sync.
    const newlyDeleted = this._lastChecklistList.filter((x) => !checklists.includes(x));
    this._lastChecklistList = Array.from(checklists);
    this._pendingDeletions.push(...newlyDeleted);

    console.debug(`SYNC: needed, deletions=${this._pendingDeletions.length}`);
  }

  public getState(): Observable<DriveSyncState> {
    return this._stateSubject.asObservable();
  }
}