import { TestBed } from '@angular/core/testing';
import { ChecklistFile, ChecklistItem_Type } from '../../../gen/ts/checklist';
import { ChecklistStorage } from './checklist-storage';

describe('ChecklistsService', () => {
  let store: ChecklistStorage;

  const A_CHECKLIST_FILE: ChecklistFile = {
    name: "N425RP",
    groups: [
      {
        title: "Normal procedures",
        checklists: [
          {
            title: "Engine out on takeoff",
            items: [
              {
                prompt: "Mood",
                expectation: "Panic",
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
    name: "Something with spaces",
    groups: [],
  };

  const YET_ANOTHER_CHECKLIST_FILE: ChecklistFile = {
    name: "Somethingwithoutspaces",
    groups: [],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(ChecklistStorage);
    store.onAfterRender();
    store.clear();
  });

  it('should be created', () => {
    expect(store).toBeTruthy();
  });

  it('should be empty at the start', () => {
    expect(store.listChecklistFiles()).toEqual(jasmine.empty());
  });

  describe('should save and read each checklist', () => {
    [A_CHECKLIST_FILE, ANOTHER_CHECKLIST_FILE, YET_ANOTHER_CHECKLIST_FILE]
      .forEach((file) => {
        beforeEach(() => {
          store.clear();
        });

        it('should save and read back a checklist', () => {
          store.saveChecklistFile(file);
          expect(store.listChecklistFiles()).toEqual([file.name]);
          expect(store.getChecklistFile(file.name)).toEqual(file);

          store.deleteChecklistFile(file.name);
          expect(store.listChecklistFiles()).toEqual([]);
          expect(store.getChecklistFile(file.name)).toBeNull();
        });
      });
  });

  it('should store and read multiple checklists', () => {
    store.saveChecklistFile(A_CHECKLIST_FILE);
    store.saveChecklistFile(ANOTHER_CHECKLIST_FILE);
    store.saveChecklistFile(YET_ANOTHER_CHECKLIST_FILE);
    expect(store.listChecklistFiles()).toEqual(
      jasmine.arrayWithExactContents(
        [A_CHECKLIST_FILE.name, ANOTHER_CHECKLIST_FILE.name, YET_ANOTHER_CHECKLIST_FILE.name]));
    expect(store.getChecklistFile(A_CHECKLIST_FILE.name)).toEqual(
      A_CHECKLIST_FILE);
    expect(store.getChecklistFile(ANOTHER_CHECKLIST_FILE.name)).toEqual(
      ANOTHER_CHECKLIST_FILE);
    expect(store.getChecklistFile(YET_ANOTHER_CHECKLIST_FILE.name)).toEqual(
      YET_ANOTHER_CHECKLIST_FILE);

    store.deleteChecklistFile(ANOTHER_CHECKLIST_FILE.name);
    expect(store.listChecklistFiles()).toEqual(
      jasmine.arrayWithExactContents(
        [A_CHECKLIST_FILE.name, YET_ANOTHER_CHECKLIST_FILE.name]));
    expect(store.getChecklistFile(ANOTHER_CHECKLIST_FILE.name)).toBeNull();
  });
});
