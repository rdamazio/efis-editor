import { inject, TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  Checklist_CompletionAction,
  ChecklistFile,
  ChecklistFileMetadata,
  ChecklistGroup_Category,
  ChecklistItem_Type,
} from '../../../gen/ts/checklist';
import { LazyBrowserStorage } from './browser-storage';
import { ChecklistStorage } from './checklist-storage';

const A_CHECKLIST_FILE: ChecklistFile = {
  metadata: ChecklistFileMetadata.create({ name: 'N425RP' }),
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
          completionAction: Checklist_CompletionAction.ACTION_GO_TO_NEXT_CHECKLIST,
        },
      ],
    },
  ],
};
const ANOTHER_CHECKLIST_FILE: ChecklistFile = {
  metadata: ChecklistFileMetadata.create({ name: 'Something with spaces' }),
  groups: [],
};

const YET_ANOTHER_CHECKLIST_FILE: ChecklistFile = {
  metadata: ChecklistFileMetadata.create({ name: 'Somethingwithoutspaces' }),
  groups: [],
};

describe('ChecklistStorage', () => {
  let store: ChecklistStorage;

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  beforeEach(inject(
    [ChecklistStorage, LazyBrowserStorage],
    async (s: ChecklistStorage, browserStore: LazyBrowserStorage) => {
      browserStore.forceBrowserStorage();
      store = s;
      await store.clear();
    },
  ));

  afterEach(async () => {
    await store.clear();
  });

  it('should be created', () => {
    expect(store).toBeTruthy();
  });

  it('should be empty at the start', async () => {
    await expect(firstValueFrom(store.listChecklistFiles(), { defaultValue: [123] })).resolves.toHaveLength(0);
  });

  async function getChecklistFile(name: string): Promise<ChecklistFile | null> {
    const checklist = await store.getChecklistFile(name);
    if (checklist) {
      checklist.metadata!.modifiedTime = 0;
    }
    return checklist;
  }

  describe('should save and read each checklist', () => {
    it.each([
      { label: 'A_CHECKLIST_FILE', file: A_CHECKLIST_FILE },
      { label: 'ANOTHER_CHECKLIST_FILE', file: ANOTHER_CHECKLIST_FILE },
      { label: 'YET_ANOTHER_CHECKLIST_FILE', file: YET_ANOTHER_CHECKLIST_FILE },
    ])('should save and read back $label', async ({ file }) => {
      await store.clear();

      await store.saveChecklistFile(file);
      const files$ = store.listChecklistFiles();

      await expect(firstValueFrom(files$, { defaultValue: 'FAIL' })).resolves.toEqual([file.metadata!.name]);

      const checklist = await store.getChecklistFile(file.metadata!.name);

      expect(checklist).toBeTruthy();
      expect(checklist!.metadata?.modifiedTime).toBeGreaterThan(0);

      checklist!.metadata!.modifiedTime = 0;

      expect(checklist).toEqual(file);

      await store.deleteChecklistFile(file.metadata!.name);

      await expect(firstValueFrom(files$, { defaultValue: ['FAIL'] })).resolves.toEqual([]);
      await expect(getChecklistFile(file.metadata!.name)).resolves.toBeNull();
    });
  });

  it('should store and read multiple checklists', async () => {
    await store.saveChecklistFile(A_CHECKLIST_FILE);
    await store.saveChecklistFile(ANOTHER_CHECKLIST_FILE);
    await store.saveChecklistFile(YET_ANOTHER_CHECKLIST_FILE);

    await expect(firstValueFrom(store.listChecklistFiles(), { defaultValue: ['FAIL'] })).resolves.toHaveLength(3);
    await expect(firstValueFrom(store.listChecklistFiles(), { defaultValue: ['FAIL'] })).resolves.toEqual(
      expect.arrayContaining([
        A_CHECKLIST_FILE.metadata!.name,
        ANOTHER_CHECKLIST_FILE.metadata!.name,
        YET_ANOTHER_CHECKLIST_FILE.metadata!.name,
      ]),
    );
    await expect(getChecklistFile(A_CHECKLIST_FILE.metadata!.name)).resolves.toEqual(A_CHECKLIST_FILE);
    await expect(getChecklistFile(ANOTHER_CHECKLIST_FILE.metadata!.name)).resolves.toEqual(ANOTHER_CHECKLIST_FILE);
    await expect(getChecklistFile(YET_ANOTHER_CHECKLIST_FILE.metadata!.name)).resolves.toEqual(
      YET_ANOTHER_CHECKLIST_FILE,
    );

    await store.deleteChecklistFile(ANOTHER_CHECKLIST_FILE.metadata!.name);

    await expect(firstValueFrom(store.listChecklistFiles(), { defaultValue: ['FAIL'] })).resolves.toHaveLength(2);
    await expect(firstValueFrom(store.listChecklistFiles(), { defaultValue: ['FAIL'] })).resolves.toEqual(
      expect.arrayContaining([A_CHECKLIST_FILE.metadata!.name, YET_ANOTHER_CHECKLIST_FILE.metadata!.name]),
    );
    await expect(getChecklistFile(ANOTHER_CHECKLIST_FILE.metadata!.name)).resolves.toBeNull();
  });
});
