import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  ChecklistFile,
  ChecklistFileMetadata,
  ChecklistGroup_Category,
  ChecklistItem_Type,
} from '../../../gen/ts/checklist';
import { LazyBrowserStorage } from './browser-storage';
import { ChecklistStorage } from './checklist-storage';

const A_CHECKLIST_FILE: ChecklistFile = {
  metadata: ChecklistFileMetadata.create({
    name: 'N425RP',
  }),
  groups: [
    {
      category: ChecklistGroup_Category.normal,
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

describe('ChecklistsService', () => {
  let store: ChecklistStorage;

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    const browserStore = TestBed.inject(LazyBrowserStorage);
    browserStore.forceBrowserStorage();

    store = TestBed.inject(ChecklistStorage);
    await store.clear();
  });

  it('should be created', () => {
    expect(store).toBeTruthy();
  });

  it('should be empty at the start', async () => {
    expect(await firstValueFrom(store.listChecklistFiles(), { defaultValue: [123] })).toEqual(jasmine.empty());
  });

  async function getChecklistFile(name: string): Promise<ChecklistFile | null> {
    const checklist = await store.getChecklistFile(name);
    if (checklist) {
      checklist.metadata!.modifiedTime = 0;
    }
    return checklist;
  }

  describe('should save and read each checklist', () => {
    [A_CHECKLIST_FILE, ANOTHER_CHECKLIST_FILE, YET_ANOTHER_CHECKLIST_FILE].forEach((file: ChecklistFile) => {
      beforeEach(async () => {
        await store.clear();
      });

      it('should save and read back a checklist', async () => {
        await store.saveChecklistFile(file);
        const files$ = store.listChecklistFiles();
        expect(await firstValueFrom(files$, { defaultValue: 'FAIL' })).toEqual([file.metadata!.name]);
        const checklist = await store.getChecklistFile(file.metadata!.name);
        expect(checklist).toBeTruthy();
        expect(checklist!.metadata?.modifiedTime).toBeGreaterThan(0);
        checklist!.metadata!.modifiedTime = 0;
        expect(checklist).toEqual(file);

        await store.deleteChecklistFile(file.metadata!.name);
        expect(await firstValueFrom(files$, { defaultValue: ['FAIL'] })).toEqual([]);
        expect(await getChecklistFile(file.metadata!.name)).toBeNull();
      });
    });
  });

  it('should store and read multiple checklists', async () => {
    await store.saveChecklistFile(A_CHECKLIST_FILE);
    await store.saveChecklistFile(ANOTHER_CHECKLIST_FILE);
    await store.saveChecklistFile(YET_ANOTHER_CHECKLIST_FILE);
    expect(await firstValueFrom(store.listChecklistFiles(), { defaultValue: ['FAIL'] })).toEqual(
      jasmine.arrayWithExactContents([
        A_CHECKLIST_FILE.metadata!.name,
        ANOTHER_CHECKLIST_FILE.metadata!.name,
        YET_ANOTHER_CHECKLIST_FILE.metadata!.name,
      ]),
    );
    expect(await getChecklistFile(A_CHECKLIST_FILE.metadata!.name)).toEqual(A_CHECKLIST_FILE);
    expect(await getChecklistFile(ANOTHER_CHECKLIST_FILE.metadata!.name)).toEqual(ANOTHER_CHECKLIST_FILE);
    expect(await getChecklistFile(YET_ANOTHER_CHECKLIST_FILE.metadata!.name)).toEqual(YET_ANOTHER_CHECKLIST_FILE);

    await store.deleteChecklistFile(ANOTHER_CHECKLIST_FILE.metadata!.name);
    expect(await firstValueFrom(store.listChecklistFiles(), { defaultValue: ['FAIL'] })).toEqual(
      jasmine.arrayWithExactContents([A_CHECKLIST_FILE.metadata!.name, YET_ANOTHER_CHECKLIST_FILE.metadata!.name]),
    );
    expect(await getChecklistFile(ANOTHER_CHECKLIST_FILE.metadata!.name)).toBeNull();

    await store.clear();
  });
});
