import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ChecklistFile, ChecklistFileMetadata, ChecklistItem_Type } from '../../../gen/ts/checklist';
import { ChecklistStorage } from './checklist-storage';

describe('ChecklistsService', () => {
  let store: ChecklistStorage;

  const A_CHECKLIST_FILE: ChecklistFile = {
    metadata: ChecklistFileMetadata.create({
      name: 'N425RP',
    }),
    groups: [
      {
        title: 'Normal procedures',
        checklists: [
          {
            title: 'Engine out on takeoff',
            items: [
              {
                prompt: 'Mood',
                expectation: 'Panic',
                type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
                indent: 1,
                centered: false,
              },
            ],
          },
        ],
      },
    ],
  };
  const ANOTHER_CHECKLIST_FILE: ChecklistFile = {
    metadata: ChecklistFileMetadata.create({
      name: 'Something with spaces',
    }),
    groups: [],
  };

  const YET_ANOTHER_CHECKLIST_FILE: ChecklistFile = {
    metadata: ChecklistFileMetadata.create({
      name: 'Somethingwithoutspaces',
    }),
    groups: [],
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(ChecklistStorage);
    store.forceBrowserStorage();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(store).toBeTruthy();
  });

  it('should be empty at the start', async () => {
    expect(await firstValueFrom(store.listChecklistFiles())).toEqual(jasmine.empty());
  });

  describe('should save and read each checklist', () => {
    [A_CHECKLIST_FILE, ANOTHER_CHECKLIST_FILE, YET_ANOTHER_CHECKLIST_FILE].forEach((file) => {
      beforeEach(async () => {
        localStorage.clear();
      });

      it('should save and read back a checklist', async () => {
        await store.saveChecklistFile(file);
        const files = store.listChecklistFiles();
        expect(await firstValueFrom(files)).toEqual([file.metadata!.name]);
        expect(await store.getChecklistFile(file.metadata!.name)).toEqual(file);

        await store.deleteChecklistFile(file.metadata!.name);
        expect(await firstValueFrom(files)).toEqual([]);
        expect(await store.getChecklistFile(file.metadata!.name)).toBeNull();
      });
    });
  });

  it('should store and read multiple checklists', async () => {
    await store.saveChecklistFile(A_CHECKLIST_FILE);
    await store.saveChecklistFile(ANOTHER_CHECKLIST_FILE);
    await store.saveChecklistFile(YET_ANOTHER_CHECKLIST_FILE);
    expect(await firstValueFrom(store.listChecklistFiles())).toEqual(
      jasmine.arrayWithExactContents([
        A_CHECKLIST_FILE.metadata!.name,
        ANOTHER_CHECKLIST_FILE.metadata!.name,
        YET_ANOTHER_CHECKLIST_FILE.metadata!.name,
      ]),
    );
    expect(await store.getChecklistFile(A_CHECKLIST_FILE.metadata!.name)).toEqual(A_CHECKLIST_FILE);
    expect(await store.getChecklistFile(ANOTHER_CHECKLIST_FILE.metadata!.name)).toEqual(ANOTHER_CHECKLIST_FILE);
    expect(await store.getChecklistFile(YET_ANOTHER_CHECKLIST_FILE.metadata!.name)).toEqual(YET_ANOTHER_CHECKLIST_FILE);

    await store.deleteChecklistFile(ANOTHER_CHECKLIST_FILE.metadata!.name);
    expect(await firstValueFrom(store.listChecklistFiles())).toEqual(
      jasmine.arrayWithExactContents([A_CHECKLIST_FILE.metadata!.name, YET_ANOTHER_CHECKLIST_FILE.metadata!.name]),
    );
    expect(await store.getChecklistFile(ANOTHER_CHECKLIST_FILE.metadata!.name)).toBeNull();

    await store.clear();
  });
});
