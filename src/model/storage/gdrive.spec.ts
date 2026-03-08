import { TestBed } from '@angular/core/testing';
import { filter, firstValueFrom, Subscription } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { ChecklistFile, ChecklistGroup } from '../../../gen/ts/checklist';
import { EXPECTED_CONTENTS } from '../formats/test-data';
import { LazyBrowserStorage } from './browser-storage';
import { ChecklistStorage } from './checklist-storage';
import { DriveSyncState, GoogleDriveStorage } from './gdrive';
import { GoogleDriveApi } from './gdrive-api';

// Note: timestamps get rounded to 1 second when saving,
// so we use times that are already round.
const NEWER_MTIME = new Date('2024-11-17T00:46:15Z');
const NEWER_MTIME_UNIX = Math.floor(NEWER_MTIME.valueOf() / 1000);
const OLDER_MTIME = new Date('2022-10-05T20:45:00Z');
const OLDER_MTIME_UNIX = Math.floor(OLDER_MTIME.valueOf() / 1000);
const FAKE_NOW = new Date('2023-11-18T02:33:44Z');
const NOW_PLUS_10M = new Date(FAKE_NOW.valueOf() + 10 * 60 * 1000);
const NOW_PLUS_10M_UNIX = Math.floor(NOW_PLUS_10M.valueOf() / 1000);
const FILE_NAME = EXPECTED_CONTENTS.metadata!.name;
const FILE_ID = fileIdForName(FILE_NAME);

function fileIdForName(name: string) {
  return `fileid_${name}`;
}

describe('GoogleDriveApi', () => {
  let allStates: DriveSyncState[];
  let allDownloads: string[];
  let stateSub: Subscription | undefined;
  let downloadSub: Subscription | undefined;
  let gdriveApi: Record<keyof GoogleDriveApi, Mock> & { accessToken?: string };
  let store: ChecklistStorage;
  let lazyBrowserStore: LazyBrowserStorage;
  let browserStore: Storage;
  let gdrive: GoogleDriveStorage;

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: [
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'Date',
        'performance',
        'requestAnimationFrame',
        'cancelAnimationFrame',
      ],
    });
    vi.setSystemTime(FAKE_NOW);
    gdriveApi = {
      load: vi.fn().mockName('GoogleDriveApi.load'),
      authenticate: vi.fn().mockName('GoogleDriveApi.authenticate'),
      revokeAccessToken: vi.fn().mockName('GoogleDriveApi.revokeAccessToken'),
      listFiles: vi.fn().mockName('GoogleDriveApi.listFiles'),
      downloadFile: vi.fn().mockName('GoogleDriveApi.downloadFile'),
      uploadFile: vi.fn().mockName('GoogleDriveApi.uploadFile'),
      trashFile: vi.fn().mockName('GoogleDriveApi.trashFile'),
      deleteFile: vi.fn().mockName('GoogleDriveApi.deleteFile'),
      accessToken: '',
    };

    TestBed.configureTestingModule({ providers: [{ provide: GoogleDriveApi, useValue: gdriveApi }] });

    gdriveApi.load.mockResolvedValue(undefined);
    gdriveApi.authenticate.mockResolvedValue('some_token');
  });

  beforeEach(async () => {
    store = TestBed.inject(ChecklistStorage);
    lazyBrowserStore = TestBed.inject(LazyBrowserStorage);
    gdrive = TestBed.inject(GoogleDriveStorage);

    lazyBrowserStore.forceBrowserStorage();
    browserStore = await lazyBrowserStore.storage;
    await store.clear();

    await gdrive.init();
    allStates = [];
    stateSub = gdrive.getState().subscribe((state: DriveSyncState) => {
      allStates.push(state);
    });
    allDownloads = [];
    downloadSub = gdrive.onDownloads().subscribe((name: string) => {
      allDownloads.push(name);
    });
  });

  afterEach(async () => {
    stateSub?.unsubscribe();
    downloadSub?.unsubscribe();
    await gdrive.disableSync(false);
    await expectState(DriveSyncState.DISCONNECTED);
    gdrive.destroy();
    await store.clear();
    browserStore.clear();
    vi.useRealTimers();
  });

  async function expectState(state: DriveSyncState) {
    const currentState = await firstValueFrom(gdrive.getState(), { defaultValue: DriveSyncState.FAILED });
    expect(currentState).toEqual(state);
  }

  async function awaitState(state: DriveSyncState) {
    return firstValueFrom(gdrive.getState().pipe(filter((s) => s === state)), { defaultValue: DriveSyncState.FAILED });
  }

  function expectStates(states: DriveSyncState[]) {
    expect(allStates).toEqual(states);
  }

  function expectUpload(checklist: ChecklistFile, mtime: Date, existingFile?: boolean) {
    const name = checklist.metadata!.name;
    expect(gdriveApi.uploadFile).toHaveBeenCalledWith(
      name + GoogleDriveStorage.CHECKLIST_EXTENSION,
      existingFile ? fileIdForName(name) : undefined,
      GoogleDriveStorage.CHECKLIST_MIME_TYPE,
      mtime,
      ChecklistFile.toJsonString(checklist),
    );
  }

  function newFile(name: string, modifiedTime?: Date, mimeType?: string): gapi.client.drive.File {
    modifiedTime ??= FAKE_NOW;
    const fileId = fileIdForName(name);
    if (!mimeType || mimeType === GoogleDriveStorage.CHECKLIST_MIME_TYPE) {
      mimeType = GoogleDriveStorage.CHECKLIST_MIME_TYPE;
      name += GoogleDriveStorage.CHECKLIST_EXTENSION;
    }
    return { name: name, id: fileId, modifiedTime: modifiedTime.toISOString(), mimeType: mimeType };
  }

  it('should be created', () => {
    expect(gdrive).toBeTruthy();
    expect(gdriveApi.load).toHaveBeenCalledWith();
  });

  it('should be initially disconnected', async () => {
    await expectState(DriveSyncState.DISCONNECTED);
  });

  it('should authenticate on first sync request', async () => {
    gdriveApi.listFiles.mockResolvedValue([]);
    await gdrive.synchronize();
    expectStates([
      DriveSyncState.DISCONNECTED,
      DriveSyncState.NEEDS_SYNC,
      DriveSyncState.SYNCING,
      DriveSyncState.IN_SYNC,
    ]);
  });

  it('should preserve tokens and not re-authenticate', async () => {
    gdriveApi.listFiles.mockResolvedValue([]);
    await gdrive.synchronize();
    await expectState(DriveSyncState.IN_SYNC);
    expect(gdriveApi.authenticate).toHaveBeenCalledTimes(1);
    expect(gdriveApi.authenticate).toHaveBeenCalledWith();

    // Create it again, it should just load up the original token and run a sync with it.
    const oldGdrive = gdrive;
    gdrive = new GoogleDriveStorage(gdriveApi as unknown as GoogleDriveApi, store, lazyBrowserStore);
    await expectState(DriveSyncState.DISCONNECTED);
    await gdrive.init();
    await expectState(DriveSyncState.IN_SYNC);

    expect(gdriveApi.load).toHaveBeenCalledTimes(2);
    expect(gdriveApi.authenticate).toHaveBeenCalledTimes(1);
    expect(gdriveApi.authenticate).toHaveBeenCalledWith();
    expect(gdriveApi.accessToken).toEqual('some_token');

    await oldGdrive.disableSync(false);
    oldGdrive.destroy();
  });

  it('should forget token when disabled', async () => {
    gdriveApi.listFiles.mockResolvedValue([]);
    await gdrive.synchronize();
    await expectState(DriveSyncState.IN_SYNC);
    await gdrive.disableSync(false);
    gdrive.destroy();

    // Create it again, it should NOT load up the original token or try to sync.
    gdrive = new GoogleDriveStorage(gdriveApi as unknown as GoogleDriveApi, store, lazyBrowserStore);
    await expectState(DriveSyncState.DISCONNECTED);
    await gdrive.init();
    await expectState(DriveSyncState.DISCONNECTED);
    expect(gdriveApi.authenticate).toHaveBeenCalledTimes(1);
    expect(gdriveApi.authenticate).toHaveBeenCalledWith();
    expect(gdriveApi.accessToken).toBeUndefined();
    expect(gdriveApi.revokeAccessToken).not.toHaveBeenCalled();
  });

  it('should revoke token when requested', async () => {
    gdriveApi.revokeAccessToken.mockResolvedValue(undefined);
    gdriveApi.listFiles.mockResolvedValue([]);
    await gdrive.synchronize();
    await expectState(DriveSyncState.IN_SYNC);

    await gdrive.disableSync(true);
    await expectState(DriveSyncState.DISCONNECTED);
    expect(gdriveApi.revokeAccessToken).toHaveBeenCalledTimes(1);
    expect(gdriveApi.revokeAccessToken).toHaveBeenCalledWith();
    expect(gdriveApi.accessToken).toBeUndefined();
  });

  it('should upload a new local file', async () => {
    await store.saveChecklistFile(EXPECTED_CONTENTS, NEWER_MTIME);

    gdriveApi.listFiles.mockResolvedValue([]);
    gdriveApi.uploadFile.mockResolvedValue(undefined);
    await gdrive.synchronize();
    await expectState(DriveSyncState.IN_SYNC);

    expectUpload(EXPECTED_CONTENTS, NEWER_MTIME, false);
  });

  it('should upload a changed local file', async () => {
    await store.saveChecklistFile(EXPECTED_CONTENTS, NEWER_MTIME);

    gdriveApi.listFiles.mockResolvedValue([newFile(EXPECTED_CONTENTS.metadata!.name, OLDER_MTIME)]);
    gdriveApi.uploadFile.mockResolvedValue(undefined);
    await gdrive.synchronize();
    await expectState(DriveSyncState.IN_SYNC);

    expectUpload(EXPECTED_CONTENTS, NEWER_MTIME, true);
  });

  it('should not upload an unchanged local file', async () => {
    gdriveApi.listFiles.mockResolvedValue([newFile(EXPECTED_CONTENTS.metadata!.name, OLDER_MTIME)]);

    await store.saveChecklistFile(EXPECTED_CONTENTS, OLDER_MTIME);
    await gdrive.synchronize();

    await expectState(DriveSyncState.IN_SYNC);
    expect(gdriveApi.downloadFile).not.toHaveBeenCalled();
    expect(gdriveApi.uploadFile).not.toHaveBeenCalled();
  });

  it('should download a remote-only file', async () => {
    expect(await store.getChecklistFile(FILE_NAME)).toBeNull();

    // Verify that the download happened.
    gdriveApi.listFiles.mockResolvedValue([newFile(FILE_NAME, NEWER_MTIME)]);
    gdriveApi.downloadFile.mockImplementation(async (id: string) => {
      if (id === FILE_ID) {
        return Promise.resolve(ChecklistFile.toJsonString(EXPECTED_CONTENTS));
      }
      return Promise.reject(new Error('Unknown file ID'));
    });
    await gdrive.synchronize();
    // Saving the downloaded checklist keeps the state in "need sync" until the next sync.
    await gdrive.synchronize();
    await expectState(DriveSyncState.IN_SYNC);

    expect(gdriveApi.uploadFile).not.toHaveBeenCalled();
    expect(gdriveApi.downloadFile).toHaveBeenCalledTimes(1);
    expect(gdriveApi.downloadFile).toHaveBeenCalledWith(FILE_ID);
    expect(gdriveApi.trashFile).not.toHaveBeenCalled();
    expect(allDownloads).toHaveLength(1);
    expect(allDownloads).toEqual(expect.arrayContaining([FILE_NAME]));

    // Verify that the download was saved locally.
    const savedChecklist = await store.getChecklistFile(FILE_NAME);
    expect(savedChecklist).toBeTruthy();
    const expectedWithMtime = ChecklistFile.clone(EXPECTED_CONTENTS);
    expectedWithMtime.metadata!.modifiedTime = NEWER_MTIME_UNIX;
    expect(savedChecklist).toEqual(expectedWithMtime);
  });

  it('should download a remotely changed file', async () => {
    // Save locally with differences so we can verify that the download overrode it.
    const localChecklist = ChecklistFile.clone(EXPECTED_CONTENTS);
    localChecklist.metadata!.aircraftInfo = 'Diamond DA-62';
    localChecklist.groups.push(ChecklistGroup.create({ title: 'Old group that got deleted' }));
    await store.saveChecklistFile(localChecklist, OLDER_MTIME);

    // Verify that the download happened.
    gdriveApi.listFiles.mockResolvedValue([newFile(FILE_NAME, NEWER_MTIME)]);
    gdriveApi.downloadFile.mockImplementation(async (id: string) => {
      if (id === FILE_ID) {
        return Promise.resolve(ChecklistFile.toJsonString(EXPECTED_CONTENTS));
      }
      return Promise.reject(new Error('Unknown file ID'));
    });
    await gdrive.synchronize();
    // Saving the downloaded checklist keeps the state in "need sync" until the next sync.
    await gdrive.synchronize();
    await expectState(DriveSyncState.IN_SYNC);

    expect(gdriveApi.uploadFile).not.toHaveBeenCalled();
    expect(gdriveApi.downloadFile).toHaveBeenCalledTimes(1);
    expect(gdriveApi.downloadFile).toHaveBeenCalledWith(FILE_ID);
    expect(gdriveApi.trashFile).not.toHaveBeenCalled();
    expect(allDownloads).toHaveLength(1);
    expect(allDownloads).toEqual(expect.arrayContaining([FILE_NAME]));

    // Verify that the download was saved locally.
    const savedChecklist = await store.getChecklistFile(FILE_NAME);
    expect(savedChecklist).toBeTruthy();
    const expectedWithMtime = ChecklistFile.clone(EXPECTED_CONTENTS);
    expectedWithMtime.metadata!.modifiedTime = NEWER_MTIME_UNIX;
    expect(savedChecklist).toEqual(expectedWithMtime);
  });

  it('should not download a remotely trashed file', async () => {
    const file = newFile(FILE_NAME, NEWER_MTIME);
    file.trashed = true;

    gdriveApi.listFiles.mockResolvedValue([file]);
    await gdrive.synchronize();
    await expectState(DriveSyncState.IN_SYNC);

    expect(gdriveApi.uploadFile).not.toHaveBeenCalled();
    expect(gdriveApi.downloadFile).not.toHaveBeenCalled();
    expect(gdriveApi.trashFile).not.toHaveBeenCalled();
  });

  it('should deal with a remote name collision by considering the newest one', async () => {
    await store.saveChecklistFile(EXPECTED_CONTENTS, NEWER_MTIME);

    gdriveApi.listFiles.mockResolvedValue([
      newFile(EXPECTED_CONTENTS.metadata!.name, OLDER_MTIME),
      newFile(EXPECTED_CONTENTS.metadata!.name, NEWER_MTIME),
    ]);
    await gdrive.synchronize();
    await expectState(DriveSyncState.IN_SYNC);

    expect(gdriveApi.uploadFile).not.toHaveBeenCalled();
    expect(gdriveApi.downloadFile).not.toHaveBeenCalled();
    expect(gdriveApi.trashFile).not.toHaveBeenCalled();
  });

  it('should delete a remote file when locally deleted more recently', async () => {
    // Start with a synced-up state.
    gdriveApi.listFiles.mockResolvedValue([newFile(EXPECTED_CONTENTS.metadata!.name, OLDER_MTIME)]);
    await store.saveChecklistFile(EXPECTED_CONTENTS, OLDER_MTIME);
    await gdrive.synchronize();
    await expectState(DriveSyncState.IN_SYNC);

    // Delete the file locally.
    await store.deleteChecklistFile(FILE_NAME);
    await awaitState(DriveSyncState.NEEDS_SYNC);

    gdriveApi.trashFile.mockImplementation(async (id: string) => {
      if (id === FILE_ID) {
        return Promise.resolve();
      }
      return Promise.reject(new Error('Unknown file ID'));
    });
    await gdrive.synchronize();
    await expectState(DriveSyncState.IN_SYNC);

    expect(gdriveApi.uploadFile).not.toHaveBeenCalled();
    expect(gdriveApi.downloadFile).not.toHaveBeenCalled();
    expect(gdriveApi.trashFile).toHaveBeenCalledTimes(1);
    expect(gdriveApi.trashFile).toHaveBeenCalledWith(FILE_ID);
  });

  it('should not delete a remote file when locally deleted while disconnected', async () => {
    // Sync first.
    await store.saveChecklistFile(EXPECTED_CONTENTS, OLDER_MTIME);
    gdriveApi.listFiles.mockResolvedValue([newFile(FILE_NAME, OLDER_MTIME)]);
    await gdrive.synchronize();
    await expectState(DriveSyncState.IN_SYNC);

    // Then disconnect
    await gdrive.disableSync(false);
    await expectState(DriveSyncState.DISCONNECTED);

    // Delete the file while disconnected, wait for that to propagate.
    await store.deleteChecklistFile(FILE_NAME);

    // Connect and sync again - file should be downloaded, not deleted.
    gdriveApi.downloadFile.mockImplementation(async (id: string) => {
      if (id === FILE_ID) {
        return Promise.resolve(ChecklistFile.toJsonString(EXPECTED_CONTENTS));
      }
      return Promise.reject(new Error('Unknown file ID'));
    });
    await gdrive.synchronize();
    await gdrive.synchronize();
    await expectState(DriveSyncState.IN_SYNC);

    expect(gdriveApi.downloadFile).toHaveBeenCalledTimes(1);

    expect(gdriveApi.downloadFile).toHaveBeenCalledWith(FILE_ID);
    expect(gdriveApi.trashFile).not.toHaveBeenCalled();
  });

  it('should skip a local deletion that does not exist remotely', async () => {
    await store.saveChecklistFile(EXPECTED_CONTENTS, NEWER_MTIME);
    await store.deleteChecklistFile(FILE_NAME);

    gdriveApi.listFiles.mockResolvedValue([]);
    await gdrive.synchronize();
    await expectState(DriveSyncState.IN_SYNC);

    expect(gdriveApi.uploadFile).not.toHaveBeenCalled();
    expect(gdriveApi.downloadFile).not.toHaveBeenCalled();
    expect(gdriveApi.trashFile).not.toHaveBeenCalled();
  });

  it('should download a remote file when locally deleted less recently than the remote was modified', async () => {
    await store.saveChecklistFile(EXPECTED_CONTENTS, NEWER_MTIME);
    await store.deleteChecklistFile(FILE_NAME);

    // Verify that the download happened.
    // The local deletion will get the current timestamp, so pretend the remote file is modified later.
    gdriveApi.listFiles.mockResolvedValue([newFile(FILE_NAME, NOW_PLUS_10M)]);
    gdriveApi.downloadFile.mockImplementation(async (id: string) => {
      if (id === FILE_ID) {
        return Promise.resolve(ChecklistFile.toJsonString(EXPECTED_CONTENTS));
      }
      return Promise.reject(new Error('Unknown file ID'));
    });
    await gdrive.synchronize();
    await gdrive.synchronize();
    await expectState(DriveSyncState.IN_SYNC);

    expect(gdriveApi.uploadFile).not.toHaveBeenCalled();
    expect(gdriveApi.downloadFile).toHaveBeenCalledTimes(1);
    expect(gdriveApi.downloadFile).toHaveBeenCalledWith(FILE_ID);
    expect(gdriveApi.trashFile).not.toHaveBeenCalled();
    expect(allDownloads).toHaveLength(1);
    expect(allDownloads).toEqual(expect.arrayContaining([FILE_NAME]));

    // Verify that the download was saved locally.
    const savedChecklist = await store.getChecklistFile(FILE_NAME);
    expect(savedChecklist).toBeTruthy();
    const expectedWithMtime = ChecklistFile.clone(EXPECTED_CONTENTS);
    expectedWithMtime.metadata!.modifiedTime = NOW_PLUS_10M_UNIX;
    expect(savedChecklist).toEqual(expectedWithMtime);
  });

  it('should delete a local file when remotely deleted', async () => {
    const file = newFile(FILE_NAME, NEWER_MTIME);
    file.trashed = true;
    await store.saveChecklistFile(EXPECTED_CONTENTS, OLDER_MTIME);
    expect(await store.getChecklistFile(FILE_NAME)).not.toBeNull();

    gdriveApi.listFiles.mockResolvedValue([file]);
    await gdrive.synchronize();
    await gdrive.synchronize();
    await expectState(DriveSyncState.IN_SYNC);

    expect(gdriveApi.uploadFile).not.toHaveBeenCalled();
    expect(gdriveApi.downloadFile).not.toHaveBeenCalled();
    expect(gdriveApi.trashFile).not.toHaveBeenCalled();

    // Verify that the download was deleted locally.
    const savedChecklist = await store.getChecklistFile(FILE_NAME);
    expect(savedChecklist).toBeNull();
  });

  it('should ignore a file that was deleted both locally and remotely', async () => {
    const file = newFile(FILE_NAME, NEWER_MTIME);
    file.trashed = true;
    gdriveApi.listFiles.mockResolvedValue([file]);

    await store.saveChecklistFile(EXPECTED_CONTENTS, NEWER_MTIME);
    await store.deleteChecklistFile(FILE_NAME);
    await gdrive.synchronize();
    await expectState(DriveSyncState.IN_SYNC);

    expect(gdriveApi.uploadFile).not.toHaveBeenCalled();
    expect(gdriveApi.downloadFile).not.toHaveBeenCalled();
    expect(gdriveApi.trashFile).not.toHaveBeenCalled();
  });

  it('should upload file when locally deleted but recreated', async () => {
    await store.saveChecklistFile(EXPECTED_CONTENTS, OLDER_MTIME);
    await store.deleteChecklistFile(FILE_NAME);

    // Use mtime newer than the deletion.
    await store.saveChecklistFile(EXPECTED_CONTENTS, NOW_PLUS_10M);

    gdriveApi.listFiles.mockResolvedValue([newFile(FILE_NAME, OLDER_MTIME)]);
    gdriveApi.trashFile.mockImplementation(async (id: string) => {
      if (id === FILE_ID) {
        return Promise.resolve();
      }
      return Promise.reject(new Error('Unknown file ID'));
    });

    await gdrive.synchronize();
    await expectState(DriveSyncState.IN_SYNC);

    expectUpload(EXPECTED_CONTENTS, NOW_PLUS_10M, true);
    expect(gdriveApi.downloadFile).not.toHaveBeenCalled();
    expect(gdriveApi.trashFile).not.toHaveBeenCalled();
  });

  it('should delete all gDrive data when requested', async () => {
    // Perform an initial sync just to set up state.
    await store.saveChecklistFile(EXPECTED_CONTENTS, OLDER_MTIME);
    gdriveApi.listFiles.mockResolvedValue([newFile(FILE_NAME, OLDER_MTIME)]);
    await gdrive.synchronize();
    await expectState(DriveSyncState.IN_SYNC);

    // For the deletion, pretend a different set of files are there.
    const file1 = newFile('f1', NEWER_MTIME);
    const file2 = newFile('f2', OLDER_MTIME);
    file2.trashed = true;
    gdriveApi.listFiles.mockResolvedValue([file1, file2]);

    gdriveApi.deleteFile.mockImplementation(async (id: string) => {
      if (id === file1.id || id === file2.id) {
        return Promise.resolve();
      }
      return Promise.reject(new Error('Unknown file ID'));
    });
    await gdrive.deleteAllData();
    expect(gdriveApi.deleteFile).toHaveBeenCalledTimes(2);

    expect(gdriveApi.uploadFile).not.toHaveBeenCalled();
    expect(gdriveApi.downloadFile).not.toHaveBeenCalled();
    expect(gdriveApi.trashFile).not.toHaveBeenCalled();

    // Local storage should be untouched.
    const localChecklists = await firstValueFrom(store.listChecklistFiles(), { defaultValue: [] });
    expect(localChecklists).toHaveLength(1);
    expect(localChecklists).toEqual(expect.arrayContaining([FILE_NAME]));
    const checklist = await store.getChecklistFile(FILE_NAME);
    expect(checklist).toBeTruthy();
    const expectedWithMtime = ChecklistFile.clone(EXPECTED_CONTENTS);
    expectedWithMtime.metadata!.modifiedTime = OLDER_MTIME_UNIX;
    expect(checklist).toEqual(expectedWithMtime);
  });

  it('should periodically sync every 60s when no new changes exist', async () => {
    gdriveApi.listFiles.mockResolvedValue([]);
    await gdrive.synchronize();
    await vi.advanceTimersByTimeAsync(0);
    expectStates([
      DriveSyncState.DISCONNECTED,
      DriveSyncState.NEEDS_SYNC,
      DriveSyncState.SYNCING,
      DriveSyncState.IN_SYNC,
    ]);
    allStates = [];

    const numIntervals = Math.ceil(
      GoogleDriveStorage.LONG_SYNC_INTERVAL_MS / GoogleDriveStorage.SHORT_SYNC_INTERVAL_MS,
    );
    for (let i = 0; i < numIntervals - 1; i++) {
      await vi.advanceTimersByTimeAsync(GoogleDriveStorage.SHORT_SYNC_INTERVAL_MS);
      expectStates([]);
    }
    await vi.advanceTimersByTimeAsync(GoogleDriveStorage.SHORT_SYNC_INTERVAL_MS);
    expectStates([DriveSyncState.SYNCING, DriveSyncState.IN_SYNC]);
    allStates = [];

    await vi.advanceTimersByTimeAsync(GoogleDriveStorage.SHORT_SYNC_INTERVAL_MS);
    expectStates([]);

    // Must happen earlier to clean up for fakeAsync.
    gdrive.destroy();
  });

  it('should periodically sync every 10s when new changes exist', async () => {
    gdriveApi.listFiles.mockResolvedValue([]);

    await gdrive.synchronize();
    await vi.advanceTimersByTimeAsync(0);
    expectStates([
      DriveSyncState.DISCONNECTED,
      DriveSyncState.NEEDS_SYNC,
      DriveSyncState.SYNCING,
      DriveSyncState.IN_SYNC,
    ]);
    allStates = [];

    await vi.advanceTimersByTimeAsync(GoogleDriveStorage.SHORT_SYNC_INTERVAL_MS);
    expectStates([]);

    // Make a change that will need synchronization.
    // Note: store.saveChecklistFile doesn't work well with fakeAsync: https://github.com/angular/angular/issues/31702
    await store.clear();
    await vi.advanceTimersByTimeAsync(0);
    await expectState(DriveSyncState.NEEDS_SYNC);

    // Check that synchronization happened.
    await vi.advanceTimersByTimeAsync(GoogleDriveStorage.SHORT_SYNC_INTERVAL_MS);
    expectStates([DriveSyncState.NEEDS_SYNC, DriveSyncState.SYNCING, DriveSyncState.IN_SYNC]);
    allStates = [];

    await vi.advanceTimersByTimeAsync(GoogleDriveStorage.SHORT_SYNC_INTERVAL_MS);
    expectStates([]);

    // Must happen earlier to clean up for fakeAsync.
    gdrive.destroy();
  });
});
