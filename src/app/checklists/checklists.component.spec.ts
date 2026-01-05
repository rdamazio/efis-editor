import { EventEmitter, signal } from '@angular/core';
import { DeferBlockState, inject, TestBed } from '@angular/core/testing';
import { MAT_SNACK_BAR_DEFAULT_OPTIONS, MatSnackBar } from '@angular/material/snack-bar';
import { NavigationExtras, Router, ROUTER_OUTLET_DATA } from '@angular/router';
import { render, RenderResult, screen, within } from '@testing-library/angular';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { firstValueFrom, Subject, take } from 'rxjs';
import type { Mock } from 'vitest';
import { ChecklistFile, ChecklistGroup_Category, ChecklistItem, ChecklistItem_Type } from '../../../gen/ts/checklist';
import { EXPECTED_CONTENTS } from '../../model/formats/test-data';
import { LazyBrowserStorage } from '../../model/storage/browser-storage';
import { ChecklistStorage } from '../../model/storage/checklist-storage';
import { NavData } from '../nav/nav-data';
import { HOTKEY_DEBOUNCE_TIME } from '../shared/hotkeys/hotkey-registration';
import { ChecklistsComponent } from './checklists.component';

const NEW_FILE = ChecklistFile.create({
  metadata: { name: 'My file' },
  groups: [
    {
      title: 'First checklist group',
      category: ChecklistGroup_Category.normal,
      checklists: [
        {
          title: 'First checklist',
          items: [
            { type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE, prompt: 'Checklist created', expectation: 'CHECK' },
          ],
        },
      ],
    },
  ],
});

describe('ChecklistsComponent', () => {
  let originalTimeout: number;
  let user: UserEvent;
  let rendered: RenderResult<ChecklistsComponent>;
  let storage: ChecklistStorage;
  let navigate: Mock;
  let showSnack: Mock;
  let navData: NavData;

  let realNavigate: (commands: unknown[], extras?: NavigationExtras) => Promise<boolean>;
  let metaKey: string;

  beforeEach(async () => {
    // We have a lot of large tests in this file, override the timeout.
    // Give even more time to avoid hitting slow coverage instrumentation timeouts.
    originalTimeout = 5000;
    vi.setConfig({ testTimeout: 60000 });

    // ngneat/hotkeys uses different keys for Meta on PC vs Mac - detect where we're running tests.
    const isPC = !navigator.userAgent.includes('Macintosh');
    metaKey = isPC ? 'ControlLeft' : 'MetaLeft';

    user = userEvent.setup({ delay: null });

    navData = {
      routeTitle: signal(undefined),
      fileName: signal(undefined),
      showSearch: signal(false),
      searchQuery: signal(''),
      searchMatchCurrent: signal(0),
      searchMatchTotal: signal(0),
      searchNext: new EventEmitter<void>(),
      searchPrev: new EventEmitter<void>(),
    };

    window.location.hash = '';

    rendered = await render(ChecklistsComponent, {
      providers: [
        { provide: ROUTER_OUTLET_DATA, useValue: signal(navData) },
        { provide: MAT_SNACK_BAR_DEFAULT_OPTIONS, useValue: { duration: 0 } },
        { provide: HOTKEY_DEBOUNCE_TIME, useValue: 20 },
      ],
      deferBlockStates: DeferBlockState.Complete,
    });
  });

  beforeEach(inject(
    [ChecklistStorage, LazyBrowserStorage, MatSnackBar, Router],
    async (s: ChecklistStorage, browserStore: LazyBrowserStorage, snack: MatSnackBar, router: Router) => {
      realNavigate = router.navigate.bind(router);
      navigate = vi.spyOn(router, 'navigate');

      // Verifying snackbars with durations doesn't work with MatSnackBarHarness, so use a spy instead.
      // https://github.com/angular/components/issues/19290
      showSnack = vi.spyOn(snack, 'open');

      storage = s;
      browserStore.forceBrowserStorage();

      await storage.clear();
    },
  ));

  afterEach(async () => {
    await rendered.fixture.whenStable();
    await storage.clear();
    vi.setConfig({ testTimeout: originalTimeout });
  });

  async function newFile(fileName: string, waitForStorage = true) {
    const completed = waitForStorage ? storageCompletion() : undefined;
    await user.click(screen.getByRole('button', { name: 'New file' }));
    const checklistTitleBox = await screen.findByRole('textbox', { name: 'Title' });
    await retype(checklistTitleBox, `${fileName}[Enter]`);

    rendered.detectChanges();
    await rendered.fixture.whenStable();
    await storageCompleted(completed);
  }

  async function newEmptyFile(fileName: string) {
    // Create new file
    await newFile(fileName);

    // Delete its default group
    await user.hover(screen.getByText('First checklist group'));
    const group1 = screen.getByRole('treeitem', { name: 'Group: First checklist group' });
    await user.click(within(group1).getByRole('button', { name: 'Delete First checklist group' }));
    const groupConfirmButton = await screen.findByRole('button', { name: 'Delete!' });
    const completed = storageCompletion();
    await user.click(groupConfirmButton);
    await storageCompleted(completed);
  }

  async function addGroup(groupTitle: string, waitForStorage = true) {
    const completed = waitForStorage ? storageCompletion() : undefined;
    const addGroupButton = screen.getByRole('button', { name: 'Add new checklist group' });
    await user.click(addGroupButton);

    const checklistTitleBox = await screen.findByRole('textbox', { name: 'Title' });
    await retype(checklistTitleBox, `${groupTitle}[Enter]`);

    await storageCompleted(completed);
  }

  async function addChecklist(groupTitle: string, checklistTitle: string, waitForStorage = true) {
    const completed = waitForStorage ? storageCompletion() : undefined;
    const group = screen.getByRole('treeitem', { name: `Group: ${groupTitle}` });
    const addChecklistButton = within(group).getByRole('button', { name: 'Add new checklist' });
    await user.click(addChecklistButton);

    const checklistTitleBox = await screen.findByRole('textbox', { name: 'Title' });
    await retype(checklistTitleBox, `${checklistTitle}[Enter]`);

    await storageCompleted(completed);
  }

  async function addItem(type: string, prompt?: string, expectation?: string, waitForStorage = true) {
    const newButton = screen.getByRole('button', { name: `Add a new checklist ${type}` });

    let completed = waitForStorage ? storageCompletion() : undefined;
    await user.click(newButton);

    if (prompt) {
      await storageCompleted(completed);

      const item = screen.getByRole('listitem', { name: 'Item: New item' });
      const itemPromptBox = await within(item).findByRole('textbox', { name: 'Prompt text' });
      await retype(itemPromptBox, prompt);

      if (expectation) {
        const itemExpectationBox = await within(item).findByRole('textbox', { name: 'Expectation text' });
        await retype(itemExpectationBox, expectation);
      }
      completed = waitForStorage ? storageCompletion() : undefined;
      await user.click(within(item).getByRole('button', { name: 'Save changes to Prompt text' }));
    }
    await storageCompleted(completed);
  }

  async function retype(element: HTMLElement, text: string) {
    await user.clear(element);

    if (text.endsWith('[Enter]')) {
      const pasteText = text.slice(0, -7);
      if (pasteText) {
        await user.paste(pasteText);
      }
      await user.keyboard('[Enter]');
    } else {
      await user.paste(text);
    }
  }

  async function setFragment(fragment: string) {
    await realNavigate([], { fragment: fragment });

    rendered.detectChanges();
    await rendered.fixture.whenStable();
  }

  function expectFragment(fragment: string) {
    expect(navigate).toHaveBeenLastCalledWith([], expect.objectContaining({ fragment }));
  }

  function expectNavData(fileName?: string) {
    expect(navData.routeTitle()).toEqual('Checklists');
    expect(navData.fileName()).toEqual(fileName);
  }

  function expectLastSnackMatching(pattern: string | RegExp) {
    expect(showSnack).toHaveBeenLastCalledWith(expect.stringMatching(pattern), expect.any(String));
  }

  async function storageCompletion(): Promise<boolean> {
    // There's no good way to wait for some of the storage asynchronous operations, so inject one.
    const component = rendered.fixture.componentInstance;
    component.storageCompleted$ = new Subject<boolean>();

    return firstValueFrom(component.storageCompleted$.pipe(take(1)), { defaultValue: false });
  }

  async function storageCompleted(completed?: Promise<boolean>) {
    if (completed) {
      await expect(completed).resolves.toBe(true);
    }
  }

  async function expectFile(name: string, expectedFile: ChecklistFile, completed?: Promise<boolean>) {
    await rendered.fixture.whenStable();
    await storageCompleted(completed);

    const storedFile = await storage.getChecklistFile(name);

    expect(storedFile).not.toBeNull();

    storedFile!.metadata!.modifiedTime = 0;

    expect(storedFile).toEqual(expectedFile);
  }

  it('should create a new checklist and populate it', async () => {
    const file = ChecklistFile.clone(EXPECTED_CONTENTS);
    const metadata = file.metadata!;
    const fileName = metadata.name;

    const typeMap = new Map<ChecklistItem_Type, string>();
    for (const type of ChecklistsComponent.NEW_ITEM_SHORTCUTS) {
      typeMap.set(type.type, type.typeDescription);
    }

    await newEmptyFile(fileName);
    expectFragment(fileName);
    expectNavData(fileName);

    // Add every item on the test file.
    let numBlanks = 0;
    for (const [groupIdx, group] of file.groups.entries()) {
      await addGroup(group.title);

      for (const [checklistIdx, checklist] of group.checklists.entries()) {
        await addChecklist(group.title, checklist.title);
        await user.click(screen.getByRole('treeitem', { name: `Checklist: ${checklist.title}` }));

        expectFragment(`${fileName}/${groupIdx}/${checklistIdx}`);
        expectNavData(fileName);

        for (const item of checklist.items) {
          const type = typeMap.get(item.type);
          await addItem(type!, item.prompt, item.expectation, false);

          // Perform formatting if needed.
          if (item.centered || item.indent) {
            let itemEl: HTMLElement;
            if (item.type === ChecklistItem_Type.ITEM_SPACE) {
              // Spaces don't have a unique name to look for - find the last one instead.
              const allBlanks = await screen.findAllByRole('listitem', { name: 'Blank item' });
              numBlanks++;

              expect(allBlanks).toHaveLength(numBlanks);

              itemEl = allBlanks[numBlanks - 1];
            } else {
              itemEl = await screen.findByRole('listitem', { name: `Item: ${item.prompt}` });
            }

            if (item.centered) {
              await user.click(within(itemEl).getByRole('button', { name: `Center ${item.prompt}` }));
            }
            if (item.indent) {
              const promptText = item.prompt || 'blank row';
              const indentButton = within(itemEl).getByRole('button', { name: `Indent ${promptText} right` });
              for (let i = 0; i < item.indent; i++) {
                await user.click(indentButton);
              }
            }
          }
        }
      }
    }

    // Populate the metadata.
    await user.click(screen.getByRole('button', { name: 'Open file information dialog' }));
    const aircraftMakeModelBox = await screen.findByRole('textbox', { name: 'Aircraft make and model' });
    const aircraftInfoBox = await screen.findByRole('textbox', { name: 'Aircraft information' });
    const manufacturerBox = await screen.findByRole('textbox', { name: 'Manufacturer information' });
    const copyrightBox = await screen.findByRole('textbox', { name: 'Copyright information' });
    const defaultChecklistBox = await screen.findByRole('combobox', { name: /Default checklist.*/ });
    await retype(aircraftMakeModelBox, metadata.makeAndModel);
    await retype(aircraftInfoBox, metadata.aircraftInfo);
    await retype(manufacturerBox, metadata.manufacturerInfo);
    await retype(copyrightBox, metadata.copyrightInfo);
    await user.click(defaultChecklistBox);

    const defaultChecklistTitle =
      file.groups[metadata.defaultGroupIndex].checklists[metadata.defaultChecklistIndex].title;
    const option = await screen.findByRole('option', { name: defaultChecklistTitle });
    await user.click(option);

    const completed = storageCompletion();
    const okButton = await screen.findByRole('button', { name: 'Ok' });
    await user.click(okButton);

    await expectFile(file.metadata!.name, EXPECTED_CONTENTS, completed);
  });

  it('should create and delete a file', async () => {
    await newFile('My file');

    await expect(storage.getChecklistFile('My file')).resolves.not.toBeNull();

    expectFragment('My file');
    expectNavData('My file');

    expect(screen.getByRole('treeitem', { name: 'Checklist: First checklist' })).toBeInTheDocument();

    const completed = storageCompletion();
    await user.click(screen.getByRole('button', { name: 'Delete file' }));
    const confirmButton = await screen.findByRole('button', { name: 'Delete!' });

    expect(confirmButton).toBeVisible();

    await user.click(confirmButton);

    await storageCompleted(completed);

    expect(screen.queryByRole('treeitem', { name: 'Checklist: First checklist' })).not.toBeInTheDocument();
    await expect(storage.getChecklistFile('My file')).resolves.toBeNull();

    expectFragment('');
    expectNavData(undefined);
  });

  it('should create and rename a file', async () => {
    await newFile('My file');

    await expect(storage.getChecklistFile('My file')).resolves.not.toBeNull();

    expectFragment('My file');
    expectNavData('My file');

    const completed = storageCompletion();
    await user.click(screen.getByRole('button', { name: 'Open file information dialog' }));
    const nameBox = await screen.findByRole('textbox', { name: 'File name' });
    await retype(nameBox, 'Renamed file');

    const okButton = await screen.findByRole('button', { name: 'Ok' });
    await user.click(okButton);

    await storageCompleted(completed);

    await expect(storage.getChecklistFile('My file')).resolves.toBeNull();
    await expect(storage.getChecklistFile('Renamed file')).resolves.not.toBeNull();

    expectFragment('Renamed file');
    expectNavData('Renamed file');
  });

  it('should rename a file through navigation', async () => {
    await newFile('My file');

    await expect(storage.getChecklistFile('My file')).resolves.not.toBeNull();

    expectFragment('My file');
    expectNavData('My file');

    const completed = storageCompletion();

    navData.fileName.set('Renamed file');

    rendered.detectChanges();
    TestBed.tick();
    await rendered.fixture.whenStable();

    await storageCompleted(completed);

    expectFragment('Renamed file');

    await expect(storage.getChecklistFile('My file')).resolves.toBeNull();
    await expect(storage.getChecklistFile('Renamed file')).resolves.not.toBeNull();
  });

  it('should not overwrite an existing file', async () => {
    await newFile('My file');
    await user.click(await screen.findByRole('treeitem', { name: 'Checklist: First checklist' }));
    await addItem('caution', 'Second item');

    expect(screen.getByRole('listitem', { name: 'Item: Second item' })).toBeInTheDocument();

    // Try to create the same file again - this should fail, keeping the original file.
    // (there's no way to wait for a storage event NOT happening, so we don't wait)
    await newFile('My file', false);

    expect(screen.getByRole('listitem', { name: 'Item: Second item' })).toBeInTheDocument();

    const expectedFile = ChecklistFile.clone(NEW_FILE);
    expectedFile.groups[0].checklists[0].items.push(
      ChecklistItem.create({ type: ChecklistItem_Type.ITEM_CAUTION, prompt: 'Second item' }),
    );
    await expectFile('My file', expectedFile);
  });

  it('should rename groups, checklists and items', async () => {
    await newFile('My file');

    // Select the checklist.
    const checklist = screen.getByRole('treeitem', { name: 'Checklist: First checklist' });
    await user.click(checklist);

    // Modify the item.
    const item = screen.getByRole('listitem', { name: 'Item: Checklist created' });
    await user.click(within(item).getByRole('button', { name: /Edit.*/ }));

    const promptBox = await screen.findByRole('textbox', { name: 'Prompt text' });
    const expectationBox = await screen.findByRole('textbox', { name: 'Expectation text' });
    const itemCompleted = storageCompletion();
    await retype(promptBox, 'New prompt');
    await retype(expectationBox, 'New expectation[Enter]');
    await storageCompleted(itemCompleted);

    // Rename the checklist.
    await user.hover(screen.getByText('First checklist'));
    await user.click(await within(checklist).findByRole('button', { name: 'Rename First checklist' }));

    const checklistTitleBox = await screen.findByRole('textbox', { name: 'Title' });
    const checklistCompleted = storageCompletion();
    await retype(checklistTitleBox, 'Renamed checklist[Enter]');
    await storageCompleted(checklistCompleted);

    // Rename the group.
    const group = screen.getByRole('treeitem', { name: 'Group: First checklist group' });
    await user.hover(screen.getByText('First checklist group'));
    await user.click(await within(group).findByRole('button', { name: 'Rename First checklist group' }));

    const groupTitleBox = await screen.findByRole('textbox', { name: 'Title' });
    const groupCompleted = storageCompletion();
    await retype(groupTitleBox, 'Renamed group[Enter]');
    await storageCompleted(groupCompleted);

    // Verify the stored contents.
    await expectFile(
      'My file',
      ChecklistFile.create({
        metadata: { name: 'My file' },
        groups: [
          {
            title: 'Renamed group',
            category: ChecklistGroup_Category.normal,
            checklists: [
              {
                title: 'Renamed checklist',
                items: [
                  {
                    type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
                    prompt: 'New prompt',
                    expectation: 'New expectation',
                  },
                ],
              },
            ],
          },
        ],
      }),
    );
  });

  it('should delete items', async () => {
    await newFile('My file');

    // Select the checklist.
    const checklist = screen.getByRole('treeitem', { name: 'Checklist: First checklist' });
    await user.click(checklist);

    // Delete the item.
    const completed = storageCompletion();
    const item = screen.getByRole('listitem', { name: 'Item: Checklist created' });
    await user.click(within(item).getByRole('button', { name: /Delete.*/ }));

    expect(screen.queryByRole('listitem', { name: 'Item: Checklist created' })).not.toBeInTheDocument();

    // Verify the stored contents.
    const expectedFile = ChecklistFile.clone(NEW_FILE);
    expectedFile.groups[0].checklists[0].items = [];
    await expectFile('My file', expectedFile, completed);
  });

  it('should undo deletion of an item', async () => {
    await newFile('My file');
    await user.click(screen.getByRole('treeitem', { name: 'Checklist: First checklist' }));

    await addItem('caution', 'Delete me');
    const item = screen.getByRole('listitem', { name: 'Item: Delete me' });

    expect(item).toBeInTheDocument();

    // Delete the item.
    const completed = storageCompletion();
    await user.click(within(item).getByRole('button', { name: 'Delete Delete me' }));

    rendered.detectChanges();
    await rendered.fixture.whenStable();
    await vi.waitFor(() => {
      expect(screen.queryByRole('listitem', { name: 'Item: Delete me' })).not.toBeInTheDocument();
    });

    await expectFile('My file', NEW_FILE, completed);

    // Undo the deletion.
    const undoButton = await screen.findByRole('button', { name: 'Undo', hidden: true });

    expect(undoButton).toBeVisible();

    const completed2 = storageCompletion();
    await user.click(undoButton);

    // Verify that it's back to the screen and in storage.
    await expect(screen.findByRole('listitem', { name: 'Item: Delete me' })).resolves.toBeInTheDocument();

    const expectedFile = ChecklistFile.clone(NEW_FILE);
    expectedFile.groups[0].checklists[0].items.push(
      ChecklistItem.create({
        type: ChecklistItem_Type.ITEM_CAUTION,
        prompt: 'Delete me',
      }),
    );
    await expectFile('My file', expectedFile, completed2);
  });

  it('should delete checklists', async () => {
    await newFile('My file');

    // Delete the checklist.
    await user.hover(screen.getByText('First checklist'));
    const checklist = screen.getByRole('treeitem', { name: 'Checklist: First checklist' });
    await user.click(await within(checklist).findByRole('button', { name: 'Delete First checklist' }));

    const completed = storageCompletion();
    const confirmButton = await screen.findByRole('button', { name: 'Delete!' });
    await user.click(confirmButton);

    // Verify the stored contents.
    const expectedFile = ChecklistFile.clone(NEW_FILE);
    expectedFile.groups[0].checklists = [];
    await expectFile('My file', expectedFile, completed);
  });

  it('should load an existing checklist by URL', async () => {
    await newFile('My file');
    expectFragment('My file');
    expectNavData('My file');

    expect(screen.getByRole('treeitem', { name: 'Checklist: First checklist' })).toBeInTheDocument();

    await setFragment('');

    expect(screen.queryByRole('treeitem', { name: 'Checklist: First checklist' })).not.toBeInTheDocument();

    expectNavData(undefined);

    await setFragment('My file');

    await expect(screen.findByRole('treeitem', { name: 'Checklist: First checklist' })).resolves.toBeInTheDocument();

    expectNavData('My file');
  });

  it('should handle a URL fragment with a bad filename', async () => {
    await setFragment('Non-existing file');
    expectNavData(undefined);

    expect(screen.queryByRole('treeitem', { name: /Checklist:/ })).not.toBeInTheDocument();

    expectLastSnackMatching(/Failed to load.*/);
  });

  it('should handle a URL fragment with a bad group number', async () => {
    await newFile('My file');
    expectFragment('My file');
    expectNavData('My file');

    await setFragment('My file/1/0');

    expectLastSnackMatching(/.*does not have group 1.*/);

    await addGroup('Second checklist group');
    await addChecklist('Second checklist group', 'Second checklist');
    expectFragment('My file/1/0');

    expect(screen.queryByRole('listitem', { name: 'Item: Checklist created' })).not.toBeInTheDocument();

    await setFragment('My file/2/0');

    expectLastSnackMatching(/.*does not have group 2.*/);

    // Switching back to a correct URL still works.
    await setFragment('My file/0/0');

    expect(screen.getByRole('listitem', { name: 'Item: Checklist created' })).toBeInTheDocument();
  });

  it('should handle a URL fragment with a bad checklist number', async () => {
    await newFile('My file');
    expectFragment('My file');
    expectNavData('My file');

    await setFragment('My file/0/2');

    expectLastSnackMatching(/.*has no checklist 2.*/);

    // Switching back to a correct URL still works.
    await setFragment('My file/0/0');

    expect(screen.getByRole('listitem', { name: 'Item: Checklist created' })).toBeInTheDocument();
  });

  it('should handle a URL fragment with the wrong format', async () => {
    await newFile('My file');
    expectFragment('My file');
    expectNavData('My file');

    await setFragment('My file/0/0');

    expect(screen.getByRole('listitem', { name: 'Item: Checklist created' })).toBeInTheDocument();

    await setFragment('My file/0');

    expect(screen.queryByRole('listitem', { name: 'Item: Checklist created' })).not.toBeInTheDocument();

    await setFragment('My file/abc');

    expect(screen.queryByRole('listitem', { name: 'Item: Checklist created' })).not.toBeInTheDocument();

    await setFragment('My file/0x0/0x0');

    expect(screen.queryByRole('listitem', { name: 'Item: Checklist created' })).not.toBeInTheDocument();

    // Switching back to a correct URL still works.
    await setFragment('My file/0/0');

    await expect(screen.findByRole('listitem', { name: 'Item: Checklist created' })).resolves.toBeInTheDocument();
  });

  describe('keyboard shortcuts', () => {
    async function debounce() {
      // Wait for the hotkey debounce
      return new Promise((resolve) => {
        setTimeout(resolve, 30);
      });
    }

    it('should add new items', async () => {
      await newFile('My file');
      await user.click(screen.getByRole('treeitem', { name: 'Checklist: First checklist' }));

      // Delete the initially-added item.
      const item = screen.getByRole('listitem', { name: 'Item: Checklist created' });
      await user.click(within(item).getByRole('button', { name: /Delete.*/ }));

      expect(screen.queryByRole('listitem', { name: 'Item: Checklist created' })).not.toBeInTheDocument();

      // Exercise all the keyboard shortcuts.
      for (const shortcut of ChecklistsComponent.NEW_ITEM_SHORTCUTS) {
        const completedKey = storageCompletion();
        await debounce();
        await user.keyboard(`n${shortcut.secondKey}`);
        await debounce();
        await user.keyboard('[Enter]');

        await storageCompleted(completedKey);
      }

      // Create the expected resulting checklist data structure.
      const expectedItems = ChecklistsComponent.NEW_ITEM_SHORTCUTS.map((s) =>
        ChecklistItem.create({
          type: s.type,
          prompt: s.type === ChecklistItem_Type.ITEM_SPACE ? '' : 'New item',
          expectation: s.type === ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE ? 'New expectation' : '',
        }),
      );

      // Check that all the items were rendered.
      await expect(screen.findByRole('listitem', { name: 'Blank item' })).resolves.toBeVisible();
      expect(screen.getAllByRole('listitem', { name: 'Item: New item' })).toHaveLength(
        ChecklistsComponent.NEW_ITEM_SHORTCUTS.length - 1,
      );

      // Check that all the items were added to the file.
      const expectedFile = ChecklistFile.clone(NEW_FILE);
      expectedFile.groups[0].checklists[0].items = expectedItems;

      await expectFile('My file', expectedFile);
    });

    it('should edit items', async () => {
      await newFile('My file');
      await user.click(screen.getByRole('treeitem', { name: 'Checklist: First checklist' }));

      await user.keyboard('[ArrowDown]');
      await user.keyboard('[Enter]');

      const promptBox1 = await screen.findByRole('textbox', { name: 'Prompt text' });
      const expectationBox = await screen.findByRole('textbox', { name: 'Expectation text' });
      await retype(promptBox1, 'New prompt');

      const completed = storageCompletion();
      await retype(expectationBox, 'New expectation[Enter]');
      await storageCompleted(completed);

      // Items present: ['New prompt']

      await debounce();
      await user.keyboard('nw');
      await debounce();

      const completed2 = storageCompletion();
      const promptBox2 = await screen.findByRole('textbox', { name: 'Prompt text' });
      await retype(promptBox2, 'Other prompt[Enter]');

      // Check that all the items were added to the file.
      const expectedFile = ChecklistFile.clone(NEW_FILE);
      const items = expectedFile.groups[0].checklists[0].items;
      items[0].prompt = 'New prompt';
      items[0].expectation = 'New expectation';
      items.push(ChecklistItem.create({ type: ChecklistItem_Type.ITEM_WARNING, prompt: 'Other prompt' }));

      await expectFile('My file', expectedFile, completed2);

      // Items present: ['New prompt', 'Other prompt']

      // Move back up and modify the first item again.
      await debounce();
      await user.keyboard('[ArrowUp]');
      await user.keyboard('[Enter]');

      const completed3 = storageCompletion();
      const promptBox3 = await screen.findByRole('textbox', { name: 'Prompt text' });
      await retype(promptBox3, 'Third prompt[Enter]');

      expectedFile.groups[0].checklists[0].items[0].prompt = 'Third prompt';
      await expectFile('My file', expectedFile, completed3);

      // Items present: ['Third prompt', 'Other prompt']

      // Once again, but this time select the item by clicking on it.
      const secondItem = await screen.findByText('Other prompt');

      expect(secondItem).toBeVisible();

      await user.click(secondItem);
      await user.keyboard('[Enter]');

      const completed4 = storageCompletion();
      const promptBox4 = await screen.findByRole('textbox', { name: 'Prompt text' });
      await retype(promptBox4, 'Yet another prompt[Enter]');

      expectedFile.groups[0].checklists[0].items[1].prompt = 'Yet another prompt';
      await expectFile('My file', expectedFile, completed4);

      // Items present: ['Third prompt', 'Yet another prompt']
    });

    it('should indent an item', async () => {
      await newFile('My file');
      await user.click(screen.getByRole('treeitem', { name: 'Checklist: First checklist' }));

      // Select and shift the item.
      const completed = storageCompletion();
      await user.keyboard('[ArrowDown]');
      await debounce();
      await user.keyboard('[ShiftLeft>][ArrowRight][/ShiftLeft]');
      await debounce();

      // Verify that it was indented in storage.
      const expectedFile = ChecklistFile.clone(NEW_FILE);
      expectedFile.groups[0].checklists[0].items[0].indent = 1;
      await expectFile('My file', expectedFile, completed);

      // Shift it back.
      const completed2 = storageCompletion();
      await user.keyboard('[ShiftLeft>][ArrowLeft][/ShiftLeft]');

      // Verify that it was indented in storage.
      expectedFile.groups[0].checklists[0].items[0].indent = 0;
      await expectFile('My file', expectedFile, completed2);
    });

    it('should center an item', async () => {
      await newFile('My file');
      await user.click(screen.getByRole('treeitem', { name: 'Checklist: First checklist' }));

      // We can't use the built-in item because challenge/response doesn't support centering.
      await addItem('caution', 'Center me');

      expect(screen.getByText('Center me')).toBeVisible();

      // Select and shift the item.
      const completed = storageCompletion();
      // The added item will have kept focus - center it.
      await user.keyboard('[ShiftLeft>]c[/ShiftLeft]');
      await debounce();

      // Verify that it was centered in storage.
      const expectedFile = ChecklistFile.clone(NEW_FILE);
      expectedFile.groups[0].checklists[0].items.push(
        ChecklistItem.create({ type: ChecklistItem_Type.ITEM_CAUTION, prompt: 'Center me', centered: true }),
      );
      await expectFile('My file', expectedFile, completed);

      // Uncenter it.
      const completed2 = storageCompletion();
      await user.keyboard('[ShiftLeft>]c[/ShiftLeft]');
      await debounce();

      // Verify that it was indented in storage.
      expectedFile.groups[0].checklists[0].items[1].centered = false;
      await expectFile('My file', expectedFile, completed2);
    });

    it('should delete an item', async () => {
      await newFile('My file');
      await user.click(screen.getByRole('treeitem', { name: 'Checklist: First checklist' }));

      // Add an item.
      await debounce();
      await user.keyboard('nw');
      await debounce();
      rendered.detectChanges(); // HACK: Wait for the item to be added.
      const addCompleted = storageCompletion();
      await user.keyboard('[Enter]');

      await expect(addCompleted).resolves.toBe(true);

      await expect(screen.findByRole('listitem', { name: 'Item: New item' })).resolves.toBeInTheDocument();

      // Delete it.
      const completed = storageCompletion();
      await user.keyboard('[Delete]');

      // Verify that it's gone from storage and the UI.
      await expectFile('My file', NEW_FILE, completed);

      expect(screen.queryByRole('listitem', { name: 'Item: New item' })).not.toBeInTheDocument();

      // Also delete the other that was already there (it should have been selected after the other was deleted).
      const completed2 = storageCompletion();

      expect(screen.getByRole('listitem', { name: 'Item: Checklist created' })).toBeInTheDocument();

      await user.keyboard('[Delete]');

      // Verify that it's also gone from storage and the UI.
      const expectedFile = ChecklistFile.clone(NEW_FILE);
      expectedFile.groups[0].checklists[0].items = [];
      await expectFile('My file', expectedFile, completed2);

      expect(screen.queryByRole('listitem', { name: 'Item: Checklist created' })).not.toBeInTheDocument();
    });

    it('should duplicate an item', async () => {
      await newFile('My file');
      await user.click(screen.getByRole('treeitem', { name: 'Checklist: First checklist' }));

      // Add a second item.
      await addItem('caution', 'Later item');

      await expect(screen.findByRole('listitem', { name: 'Item: Checklist created' })).resolves.toBeInTheDocument();
      await expect(screen.findByRole('listitem', { name: 'Item: Later item' })).resolves.toBeInTheDocument();

      // Select the first item again.
      await user.keyboard('[ArrowUp]');

      // Duplicate it.
      const completed = storageCompletion();
      await user.keyboard(`[${metaKey}>]D[/${metaKey}]`);

      await expect(screen.findAllByRole('listitem', { name: 'Item: Checklist created' })).resolves.toHaveLength(2);

      // Check storage.
      const expectedFile = ChecklistFile.clone(NEW_FILE);
      const items = expectedFile.groups[0].checklists[0].items;
      items.push(ChecklistItem.clone(items[0]));
      items.push(
        ChecklistItem.create({
          type: ChecklistItem_Type.ITEM_CAUTION,
          prompt: 'Later item',
        }),
      );
      await expectFile('My file', expectedFile, completed);

      rendered.detectChanges();
      await rendered.fixture.whenRenderingDone();
      await debounce();

      // Edit the duplicate, which should already be selected.
      await user.keyboard('[Enter]');
      const promptBox1 = await screen.findByRole('textbox', { name: 'Prompt text' });
      const expectationBox = await screen.findByRole('textbox', { name: 'Expectation text' });
      const completed2 = storageCompletion();
      await retype(promptBox1, 'Modified item');
      await retype(expectationBox, 'Modified expectation[Enter]');

      await expect(screen.findByRole('listitem', { name: 'Item: Checklist created' })).resolves.toBeInTheDocument();
      await expect(screen.findByRole('listitem', { name: 'Item: Modified item' })).resolves.toBeInTheDocument();
      await expect(screen.findByRole('listitem', { name: 'Item: Later item' })).resolves.toBeInTheDocument();

      // Check storage.
      items[1].prompt = 'Modified item';
      items[1].expectation = 'Modified expectation';
      await expectFile('My file', expectedFile, completed2);
    });

    it('should navigate between checklists and groups', async () => {
      await newFile('My file');
      expectFragment('My file');

      await addChecklist('First checklist group', 'Second checklist');
      expectFragment('My file/0/1');
      await addGroup('Second checklist group');
      await addChecklist('Second checklist group', 'Third checklist');
      expectFragment('My file/1/0');

      // Test navigation between checklists.
      await user.keyboard(`[${metaKey}>][ArrowUp][/${metaKey}]`);
      expectFragment('My file/0/1');
      await user.keyboard(`[${metaKey}>][ArrowUp][/${metaKey}]`);
      expectFragment('My file/0/0');
      await user.keyboard(`[${metaKey}>][ArrowUp][/${metaKey}]`);
      expectFragment('My file/0/0');
      await user.keyboard(`[${metaKey}>][ArrowDown][/${metaKey}]`);
      expectFragment('My file/0/1');
      await user.keyboard(`[${metaKey}>][ArrowDown][/${metaKey}]`);
      expectFragment('My file/1/0');
      await user.keyboard(`[${metaKey}>][ArrowDown][/${metaKey}]`);
      expectFragment('My file/1/0');

      // Test navigation without an initial selection.
      await setFragment('My file');
      await user.keyboard(`[${metaKey}>][ArrowDown][/${metaKey}]`);
      expectFragment('My file/0/0');

      await setFragment('My file');
      await user.keyboard(`[${metaKey}>][ArrowUp][/${metaKey}]`);
      expectFragment('My file/1/0');

      // Test navigation between groups.
      await setFragment('My file/0/0');
      await user.keyboard('[AltLeft>][ArrowDown][/AltLeft]');
      expectFragment('My file/1/0');
      await user.keyboard('[AltLeft>][ArrowDown][/AltLeft]');
      expectFragment('My file/1/0');
      await user.keyboard('[AltLeft>][ArrowUp][/AltLeft]');
      expectFragment('My file/0/0');
      await user.keyboard('[AltLeft>][ArrowUp][/AltLeft]');
      expectFragment('My file/0/0');

      // Test navigation between groups without an initial selection.
      await setFragment('My file');
      await user.keyboard('[AltLeft>][ArrowDown][/AltLeft]');
      expectFragment('My file/0/0');

      await setFragment('My file');
      await user.keyboard('[AltLeft>][ArrowUp][/AltLeft]');
      expectFragment('My file/1/0');
    });

    it('should reorder items', async () => {
      await newFile('My file');
      const checklistTreeItem = screen.getByRole('treeitem', { name: 'Checklist: First checklist' });
      await user.click(checklistTreeItem);

      await addItem('caution', 'Second item');
      await addItem('title', 'Third item');
      await rendered.fixture.whenStable();

      // addItem may have left focus on the item - divert that elsewhere.
      checklistTreeItem.focus();
      await debounce();

      const item1 = ChecklistItem.clone(NEW_FILE.groups[0].checklists[0].items[0]);
      const item2 = ChecklistItem.create({ type: ChecklistItem_Type.ITEM_CAUTION, prompt: 'Second item' });
      const item3 = ChecklistItem.create({ type: ChecklistItem_Type.ITEM_TITLE, prompt: 'Third item' });

      // Shift first item down.
      const completed = storageCompletion();
      await user.keyboard('[ArrowDown]');
      await debounce();
      await user.keyboard('[ShiftLeft>][ArrowDown][/ShiftLeft]');
      await debounce();

      const expectedFile = ChecklistFile.clone(NEW_FILE);
      const checklist = expectedFile.groups[0].checklists[0];
      checklist.items = [item2, item1, item3];
      await expectFile('My file', expectedFile, completed);

      // Shift it again
      const completed2 = storageCompletion();
      await user.keyboard('[ShiftLeft>][ArrowDown][/ShiftLeft]');
      await debounce();

      checklist.items = [item2, item3, item1];
      await expectFile('My file', expectedFile, completed2);

      // Shift it again, even though it's already at the bottom
      await user.keyboard('[ShiftLeft>][ArrowDown][/ShiftLeft]');
      await debounce();
      await expectFile('My file', expectedFile);

      // Shift it up
      const completed4 = storageCompletion();
      await user.keyboard('[ShiftLeft>][ArrowUp][/ShiftLeft]');
      await debounce();

      checklist.items = [item2, item1, item3];
      await expectFile('My file', expectedFile, completed4);

      // Shift it up again
      const completed5 = storageCompletion();
      await user.keyboard('[ShiftLeft>][ArrowUp][/ShiftLeft]');
      await debounce();

      checklist.items = [item1, item2, item3];
      await expectFile('My file', expectedFile, completed5);

      // Shift it up again, even though it's already at the top
      await user.keyboard('[ShiftLeft>][ArrowUp][/ShiftLeft]');
      await debounce();
      await expectFile('My file', expectedFile);
    });

    it('should reorder checklists', async () => {
      await newFile('My file');
      expectFragment('My file');

      // Create two more checklists, the last in a separate group.
      // Add an item to each checklist so they're not interchangeable.
      await addChecklist('First checklist group', 'Second checklist');
      expectFragment('My file/0/1');
      await user.click(screen.getByRole('treeitem', { name: 'Checklist: Second checklist' }));
      await addItem('title', 'Checklist 2');

      await addGroup('Second checklist group');
      await addChecklist('Second checklist group', 'Third checklist');
      await user.click(screen.getByRole('treeitem', { name: 'Checklist: Third checklist' }));
      await addItem('text', 'Checklist III');
      expectFragment('My file/1/0');
      await rendered.fixture.whenStable();

      const expectedFile = (await storage.getChecklistFile('My file'))!;
      expectedFile.metadata!.modifiedTime = 0;
      const checklist1 = expectedFile.groups[0].checklists[0];
      const checklist2 = expectedFile.groups[0].checklists[1];
      const checklist3 = expectedFile.groups[1].checklists[0];

      // Move the last checklist up.
      const completed = storageCompletion();
      await user.keyboard(`[ShiftLeft>][${metaKey}>][ArrowUp][/${metaKey}][/ShiftLeft]`);
      expectFragment('My file/0/2');
      expectedFile.groups[0].checklists = [checklist1, checklist2, checklist3];
      expectedFile.groups[1].checklists = [];
      await expectFile('My file', expectedFile, completed);

      const completed2 = storageCompletion();
      await user.keyboard(`[ShiftLeft>][${metaKey}>][ArrowUp][/${metaKey}][/ShiftLeft]`);
      expectFragment('My file/0/1');
      expectedFile.groups[0].checklists = [checklist1, checklist3, checklist2];
      await expectFile('My file', expectedFile, completed2);

      const completed3 = storageCompletion();
      await user.keyboard(`[ShiftLeft>][${metaKey}>][ArrowUp][/${metaKey}][/ShiftLeft]`);
      expectFragment('My file/0/0');
      expectedFile.groups[0].checklists = [checklist3, checklist1, checklist2];
      await expectFile('My file', expectedFile, completed3);

      // Move it past the top and assert no change.
      await user.keyboard(`[ShiftLeft>][${metaKey}>][ArrowUp][/${metaKey}][/ShiftLeft]`);
      expectFragment('My file/0/0');
      await expectFile('My file', expectedFile);

      // Move it back down.
      const completed5 = storageCompletion();
      await user.keyboard(`[ShiftLeft>][${metaKey}>][ArrowDown][/${metaKey}][/ShiftLeft]`);
      expectFragment('My file/0/1');
      expectedFile.groups[0].checklists = [checklist1, checklist3, checklist2];
      await expectFile('My file', expectedFile, completed5);

      const completed6 = storageCompletion();
      await user.keyboard(`[ShiftLeft>][${metaKey}>][ArrowDown][/${metaKey}][/ShiftLeft]`);
      expectFragment('My file/0/2');
      expectedFile.groups[0].checklists = [checklist1, checklist2, checklist3];
      await expectFile('My file', expectedFile, completed6);

      const completed7 = storageCompletion();
      await user.keyboard(`[ShiftLeft>][${metaKey}>][ArrowDown][/${metaKey}][/ShiftLeft]`);
      expectFragment('My file/1/0');
      expectedFile.groups[0].checklists = [checklist1, checklist2];
      expectedFile.groups[1].checklists = [checklist3];
      await expectFile('My file', expectedFile, completed7);

      // Move it past the bottom and assert no change.
      await user.keyboard(`[ShiftLeft>][${metaKey}>][ArrowDown][/${metaKey}][/ShiftLeft]`);
      expectFragment('My file/1/0');
      await expectFile('My file', expectedFile);
    });

    it('should reorder groups', async () => {
      await newFile('My file');
      expectFragment('My file');

      // Create two more groups.
      await addChecklist('First checklist group', 'Second checklist');
      await addGroup('Second checklist group');
      await addChecklist('Second checklist group', 'Third checklist');
      await addGroup('Third checklist group');
      await addChecklist('Third checklist group', 'Fourth checklist');

      const expectedFile = (await storage.getChecklistFile('My file'))!;
      expectedFile.metadata!.modifiedTime = 0;
      const group1 = expectedFile.groups[0];
      const group2 = expectedFile.groups[1];
      const group3 = expectedFile.groups[2];

      await user.click(screen.getByRole('treeitem', { name: 'Checklist: Second checklist' }));
      expectFragment('My file/0/1');

      // Move the first group down.
      const completed2 = storageCompletion();
      await user.keyboard('[ShiftLeft>][AltLeft>][ArrowDown][/AltLeft][/ShiftLeft]');
      expectFragment('My file/1/1');
      expectedFile.groups = [group2, group1, group3];
      await expectFile('My file', expectedFile, completed2);

      const completed3 = storageCompletion();
      await user.keyboard('[ShiftLeft>][AltLeft>][ArrowDown][/AltLeft][/ShiftLeft]');
      expectFragment('My file/2/1');
      expectedFile.groups = [group2, group3, group1];
      await expectFile('My file', expectedFile, completed3);

      // Move it past the bottom and assert no change.
      await user.keyboard('[ShiftLeft>][AltLeft>][ArrowDown][/AltLeft][/ShiftLeft]');
      expectFragment('My file/2/1');
      await expectFile('My file', expectedFile);

      // Move it back up.
      const completed4 = storageCompletion();
      await user.keyboard('[ShiftLeft>][AltLeft>][ArrowUp][/AltLeft][/ShiftLeft]');
      expectFragment('My file/1/1');
      expectedFile.groups = [group2, group1, group3];
      await expectFile('My file', expectedFile, completed4);

      const completed5 = storageCompletion();
      await user.keyboard('[ShiftLeft>][AltLeft>][ArrowUp][/AltLeft][/ShiftLeft]');
      expectFragment('My file/0/1');
      expectedFile.groups = [group1, group2, group3];
      await expectFile('My file', expectedFile, completed5);

      // Move it past the top and assert no change.
      await user.keyboard('[ShiftLeft>][AltLeft>][ArrowUp][/AltLeft][/ShiftLeft]');
      expectFragment('My file/0/1');
      await expectFile('My file', expectedFile);
    });
  });

  describe('Search functionality', () => {
    it('should locate and navigate matches', async () => {
      await newFile('Search test');
      expectFragment('Search test');

      // Create some search data
      await addGroup('Group 1');
      await addChecklist('Group 1', 'Checklist 1');
      await user.click(screen.getByRole('treeitem', { name: 'Checklist: Checklist 1' }));
      await addItem('caution', 'Find me 1');
      await addItem('note', 'Ignore me');
      await addItem('text', 'Also find me 2');

      await addGroup('Group 2');
      await addChecklist('Group 2', 'Checklist 2');
      await user.click(screen.getByRole('treeitem', { name: 'Checklist: Checklist 2' }));
      await addItem('title', 'Find me 3');

      // Perform search
      navData.searchQuery.set('find me');
      rendered.detectChanges();
      await rendered.fixture.whenStable();

      expect(navData.searchMatchTotal()).toBe(3);
      expect(navData.searchMatchCurrent()).toBe(0);
      expectFragment('Search test/0/0');

      // Next
      navData.searchNext.next();
      rendered.detectChanges();
      await rendered.fixture.whenStable();
      expect(navData.searchMatchCurrent()).toBe(1);
      expectFragment('Search test/0/0'); // Still in the same checklist

      // Next again (wrap)
      navData.searchNext.next();
      rendered.detectChanges();
      await rendered.fixture.whenStable();
      expect(navData.searchMatchCurrent()).toBe(2);
      expectFragment('Search test/1/0'); // Moved to second checklist

      // Prev
      navData.searchPrev.next();
      rendered.detectChanges();
      await rendered.fixture.whenStable();
      expect(navData.searchMatchCurrent()).toBe(1);
      expectFragment('Search test/0/0');
    });
  });
});
