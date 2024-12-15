import { signal } from '@angular/core';
import { DeferBlockState, inject } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NavigationExtras, Router, ROUTER_OUTLET_DATA } from '@angular/router';
import { render, RenderResult, screen, within } from '@testing-library/angular';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { firstValueFrom, Subject, take } from 'rxjs';
import { ChecklistFile, ChecklistGroup_Category, ChecklistItem, ChecklistItem_Type } from '../../../gen/ts/checklist';
import { EXPECTED_CONTENTS } from '../../model/formats/test-data';
import { LazyBrowserStorage } from '../../model/storage/browser-storage';
import { ChecklistStorage } from '../../model/storage/checklist-storage';
import { NavData } from '../nav/nav-data';
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
            {
              type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
              prompt: 'Checklist created',
              expectation: 'CHECK',
            },
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
  let navigate: jasmine.Spy;
  let showSnack: jasmine.Spy;
  let navData: NavData;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let realNavigate: (commands: any[], extras?: NavigationExtras) => Promise<boolean>;
  let metaKey: string;

  beforeEach(async () => {
    // We have a lot of large tests in this file, override the timeout.
    // (for one, MatSnackBar delays play out in realtime).
    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;

    // ngneat/hotkeys uses different keys for Meta on PC vs Mac - detect where we're running tests.
    const isPC = !navigator.userAgent.includes('Macintosh');
    metaKey = isPC ? 'ControlLeft' : 'MetaLeft';

    user = userEvent.setup();

    navData = {
      routeTitle: signal(undefined),
      fileName: signal(undefined),
    };
    rendered = await render(ChecklistsComponent, {
      providers: [
        {
          provide: ROUTER_OUTLET_DATA,
          useValue: signal(navData),
        },
      ],
    });

    // Force rendering of all deferred blocks before we start interacting.
    const deferredBlocks = await rendered.fixture.getDeferBlocks();
    for (const deferredBlock of deferredBlocks) {
      await deferredBlock.render(DeferBlockState.Complete);
    }
  });

  beforeEach(inject(
    [ChecklistStorage, LazyBrowserStorage, MatSnackBar, Router],
    async (s: ChecklistStorage, browserStore: LazyBrowserStorage, snack: MatSnackBar, router: Router) => {
      realNavigate = router.navigate.bind(router);
      navigate = spyOn(router, 'navigate');
      navigate.and.callThrough();

      // Verifying snackbars with durations doesn't work with MatSnackBarHarness, so use a spy instead.
      // https://github.com/angular/components/issues/19290
      showSnack = spyOn(snack, 'open');
      showSnack.and.callThrough();

      storage = s;
      browserStore.forceBrowserStorage();

      await storage.clear();
    },
  ));

  afterEach(async () => {
    await storage.clear();
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
  });

  async function newFile(fileName: string) {
    await user.click(screen.getByRole('button', { name: 'New file' }));
    const checklistTitleBox = await screen.findByRole('textbox', { name: 'Title' });
    await user.type(checklistTitleBox, `${fileName}[Enter]`);
  }

  async function newEmptyFile(fileName: string) {
    // Create new file
    await newFile(fileName);

    // Delete its default group
    await user.hover(screen.getByText('First checklist group'));
    const group1 = screen.getByRole('treeitem', { name: 'Group: First checklist group' });
    await user.click(within(group1).getByRole('button', { name: 'Delete First checklist group' }));
    const groupConfirmButton = await screen.findByRole('button', { name: 'Delete!' });
    await user.click(groupConfirmButton);
  }

  async function addGroup(groupTitle: string) {
    const addGroupButton = screen.getByRole('button', { name: 'Add new checklist group' });
    await user.click(addGroupButton);

    const checklistTitleBox = await screen.findByRole('textbox', { name: 'Title' });
    await user.type(checklistTitleBox, `${groupTitle}[Enter]`);
  }

  async function addChecklist(groupTitle: string, checklistTitle: string) {
    const group = screen.getByRole('treeitem', { name: `Group: ${groupTitle}` });
    const addChecklistButton = within(group).getByRole('button', { name: 'Add new checklist' });
    await user.click(addChecklistButton);

    const checklistTitleBox = await screen.findByRole('textbox', { name: 'Title' });
    await user.type(checklistTitleBox, `${checklistTitle}[Enter]`);
  }

  async function addItem(type: string, prompt?: string, expectation?: string) {
    const newButton = screen.getByRole('button', { name: `Add a new checklist ${type}` });
    await user.click(newButton);

    if (prompt) {
      const item = screen.getByRole('listitem', { name: 'Item: New item' });
      await user.click(within(item).getByRole('button', { name: 'Edit New item' }));
      const itemPromptBox = await within(item).findByRole('textbox', { name: 'Prompt text' });
      await retype(itemPromptBox, prompt);

      if (expectation) {
        const itemExpectationBox = await within(item).findByRole('textbox', { name: 'Expectation text' });
        await retype(itemExpectationBox, expectation);
      }
      await user.click(within(item).getByRole('button', { name: 'Save changes to Prompt text' }));
    }
  }

  async function retype(element: HTMLElement, text: string) {
    await user.clear(element);
    await user.type(element, text);
  }

  async function setFragment(fragment: string) {
    await realNavigate([], { fragment: fragment });

    rendered.detectChanges();
    await rendered.fixture.whenStable();
  }

  function expectFragment(fragment: string) {
    const extras = navigate.calls.mostRecent().args[1] as NavigationExtras;
    expect(extras.fragment).toEqual(fragment);
  }

  function expectNavData(fileName?: string) {
    expect(navData.routeTitle()).toEqual('Checklists');
    expect(navData.fileName()).toEqual(fileName);
  }

  async function getChecklistFile(name: string): Promise<ChecklistFile | null> {
    rendered.detectChanges();
    await rendered.fixture.whenStable();

    return storage.getChecklistFile(name);
  }

  async function expectFile(name: string, expectedFile: ChecklistFile) {
    const storedFile = await getChecklistFile(name);
    expect(storedFile).not.toBeNull();
    storedFile!.metadata!.modifiedTime = 0;
    expect(storedFile).toEqual(expectedFile);
  }

  function lastSnackMessage(): string {
    return showSnack.calls.mostRecent().args[0] as string;
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
          await addItem(type!, item.prompt, item.expectation);

          // Perform formatting if needed.
          if (item.centered || item.indent) {
            let itemEl: HTMLElement;
            if (item.type === ChecklistItem_Type.ITEM_SPACE) {
              // Spaces don't have a unique name to look for - find the last one instead.
              const allBlanks = await screen.findAllByRole('listitem', { name: 'Blank item' });
              numBlanks++;
              expect(allBlanks).toHaveSize(numBlanks);
              itemEl = allBlanks[numBlanks - 1];
            } else {
              itemEl = await screen.findByRole('listitem', { name: `Item: ${item.prompt}` });
            }

            if (item.centered) {
              await user.click(within(itemEl).getByRole('button', { name: `Center ${item.prompt}` }));
            }
            if (item.indent) {
              const indentButton = within(itemEl).getByRole('button', { name: `Indent ${item.prompt} right` });
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

    const okButton = await screen.findByRole('button', { name: 'Ok' });
    await user.click(okButton);

    await expectFile(file.metadata!.name, EXPECTED_CONTENTS);
  });

  it('should create and delete a file', async () => {
    await newFile('My file');
    expect(await getChecklistFile('My file')).not.toBeNull();
    expectFragment('My file');
    expectNavData('My file');
    expect(screen.getByRole('treeitem', { name: 'Checklist: First checklist' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete file' }));
    const confirmButton = await screen.findByRole('button', { name: 'Delete!' });
    expect(confirmButton).toBeVisible();
    await user.click(confirmButton);

    expect(screen.queryByRole('treeitem', { name: 'Checklist: First checklist' })).not.toBeInTheDocument();
    expect(await getChecklistFile('My file')).toBeNull();
    expectFragment('');
    expectNavData(undefined);
  });

  it('should create and rename a file', async () => {
    await newFile('My file');
    expect(await getChecklistFile('My file')).not.toBeNull();
    expectFragment('My file');
    expectNavData('My file');

    await user.click(screen.getByRole('button', { name: 'Open file information dialog' }));
    const nameBox = await screen.findByRole('textbox', { name: 'File name' });
    await retype(nameBox, 'Renamed file');

    const okButton = await screen.findByRole('button', { name: 'Ok' });
    await user.click(okButton);

    expect(await getChecklistFile('My file')).toBeNull();
    expect(await getChecklistFile('Renamed file')).not.toBeNull();

    expectFragment('Renamed file');
    expectNavData('Renamed file');
  });

  it('should rename a file through navigation', async () => {
    await newFile('My file');
    expect(await getChecklistFile('My file')).not.toBeNull();
    expectFragment('My file');
    expectNavData('My file');

    // There's no good way to wait for the danling promise that the effect starts, so inject a way.
    const component = rendered.fixture.componentInstance;
    component.renameCompleted$ = new Subject<boolean>();
    const completed = firstValueFrom(component.renameCompleted$.pipe(take(1)), { defaultValue: false });

    navData.fileName.set('Renamed file');

    rendered.detectChanges();
    expect(await completed).toBeTrue();

    expectFragment('Renamed file');
    expect(await getChecklistFile('My file')).toBeNull();
    expect(await getChecklistFile('Renamed file')).not.toBeNull();
  });

  it('should not overwrite an existing file', async () => {
    await newFile('My file');
    await user.click(await screen.findByRole('treeitem', { name: 'Checklist: First checklist' }));
    await addItem('caution', 'Second item');
    expect(screen.getByRole('listitem', { name: 'Item: Second item' })).toBeInTheDocument();

    // Try to create the same file again - this should fail, keeping the original file.
    await newFile('My file');

    expect(screen.getByRole('listitem', { name: 'Item: Second item' })).toBeInTheDocument();

    const expectedFile = ChecklistFile.clone(NEW_FILE);
    expectedFile.groups[0].checklists[0].items.push(
      ChecklistItem.create({
        type: ChecklistItem_Type.ITEM_CAUTION,
        prompt: 'Second item',
      }),
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
    await retype(promptBox, 'New prompt');
    await retype(expectationBox, 'New expectation[Enter]');

    // Rename the checklist.
    await user.hover(screen.getByText('First checklist'));
    await user.click(await within(checklist).findByRole('button', { name: 'Rename First checklist' }));

    const checklistTitleBox = await screen.findByRole('textbox', { name: 'Title' });
    await retype(checklistTitleBox, 'Renamed checklist[Enter]');

    // Rename the group.
    const group = screen.getByRole('treeitem', { name: 'Group: First checklist group' });
    await user.hover(screen.getByText('First checklist group'));
    await user.click(await within(group).findByRole('button', { name: 'Rename First checklist group' }));

    const groupTitleBox = await screen.findByRole('textbox', { name: 'Title' });
    await retype(groupTitleBox, 'Renamed group[Enter]');

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
    const item = screen.getByRole('listitem', { name: 'Item: Checklist created' });
    await user.click(within(item).getByRole('button', { name: /Delete.*/ }));
    expect(screen.queryByRole('listitem', { name: 'Item: Checklist created' })).not.toBeInTheDocument();

    // Verify the stored contents.
    const expectedFile = ChecklistFile.clone(NEW_FILE);
    expectedFile.groups[0].checklists[0].items = [];
    await expectFile('My file', expectedFile);
  });

  it('should delete checklists', async () => {
    await newFile('My file');

    // Delete the checklist.
    await user.hover(screen.getByText('First checklist'));
    const checklist = screen.getByRole('treeitem', { name: 'Checklist: First checklist' });
    await user.click(await within(checklist).findByRole('button', { name: 'Delete First checklist' }));

    const confirmButton = await screen.findByRole('button', { name: 'Delete!' });
    await user.click(confirmButton);

    // Verify the stored contents.
    const expectedFile = ChecklistFile.clone(NEW_FILE);
    expectedFile.groups[0].checklists = [];
    await expectFile('My file', expectedFile);
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
    expect(await screen.findByRole('treeitem', { name: 'Checklist: First checklist' })).toBeInTheDocument();
    expectNavData('My file');
  });

  it('should handle a URL fragment with a bad filename', async () => {
    await setFragment('Non-existing file');
    expectNavData(undefined);

    expect(screen.queryByRole('treeitem', { name: /Checklist:/ })).not.toBeInTheDocument();
    expect(lastSnackMessage()).toMatch(/Failed to load.*/);
  });

  it('should handle a URL fragment with a bad group number', async () => {
    await newFile('My file');
    expectFragment('My file');
    expectNavData('My file');

    await setFragment('My file/1/0');
    expect(lastSnackMessage()).toMatch(/.*does not have group 1.*/);

    await addGroup('Second checklist group');
    await addChecklist('Second checklist group', 'Second checklist');
    expectFragment('My file/1/0');
    expect(screen.queryByRole('listitem', { name: 'Item: Checklist created' })).not.toBeInTheDocument();

    await setFragment('My file/2/0');
    expect(lastSnackMessage()).toMatch(/.*does not have group 2.*/);

    // Switching back to a correct URL still works.
    await setFragment('My file/0/0');
    expect(screen.getByRole('listitem', { name: 'Item: Checklist created' })).toBeInTheDocument();
  });

  it('should handle a URL fragment with a bad checklist number', async () => {
    await newFile('My file');
    expectFragment('My file');
    expectNavData('My file');

    await setFragment('My file/0/2');
    expect(lastSnackMessage()).toMatch(/.*has no checklist 2.*/);

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
    expect(await screen.findByRole('listitem', { name: 'Item: Checklist created' })).toBeInTheDocument();
  });

  describe('keyboard shortcuts', () => {
    async function debounce() {
      return new Promise((resolve) => {
        setTimeout(resolve, 550);
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
        await debounce();
        await user.keyboard('n');
        await user.keyboard(shortcut.secondKey);
      }
      await debounce();

      // Create the expected resulting checklist data structure.
      const expectedItems = ChecklistsComponent.NEW_ITEM_SHORTCUTS.map((s) =>
        ChecklistItem.create({
          type: s.type,
          prompt: s.type === ChecklistItem_Type.ITEM_SPACE ? '' : 'New item',
          expectation: s.type === ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE ? 'New expectation' : '',
        }),
      );

      // Check that all the items were rendered.
      expect(await screen.findByRole('listitem', { name: 'Blank item' })).toBeVisible();
      expect(screen.getAllByRole('listitem', { name: 'Item: New item' })).toHaveSize(
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
      await retype(expectationBox, 'New expectation[Enter]');

      await debounce();
      await user.keyboard('nw');
      await debounce();
      await user.keyboard('[ArrowDown]');
      await user.keyboard('[Enter]');

      const promptBox2 = await screen.findByRole('textbox', { name: 'Prompt text' });
      await retype(promptBox2, 'Other prompt[Enter]');

      // Check that all the items were added to the file.
      const expectedFile = ChecklistFile.clone(NEW_FILE);
      const items = expectedFile.groups[0].checklists[0].items;
      items[0].prompt = 'New prompt';
      items[0].expectation = 'New expectation';
      items.push(
        ChecklistItem.create({
          type: ChecklistItem_Type.ITEM_WARNING,
          prompt: 'Other prompt',
        }),
      );

      await expectFile('My file', expectedFile);

      // Move back up and modify the first item again.
      await user.keyboard('[ArrowUp]');
      await user.keyboard('[Enter]');

      const promptBox3 = await screen.findByRole('textbox', { name: 'Prompt text' });
      await retype(promptBox3, 'Third prompt[Enter]');

      expectedFile.groups[0].checklists[0].items[0].prompt = 'Third prompt';
      await expectFile('My file', expectedFile);
    });

    it('should indent an item', async () => {
      await newFile('My file');
      await user.click(screen.getByRole('treeitem', { name: 'Checklist: First checklist' }));

      // Select and shift the item.
      await user.keyboard('[ArrowDown]');
      await user.keyboard('[ShiftLeft>][ArrowRight][/ShiftLeft]');

      // Verify that it was indented in storage.
      const expectedFile = ChecklistFile.clone(NEW_FILE);
      expectedFile.groups[0].checklists[0].items[0].indent = 1;
      await expectFile('My file', expectedFile);

      // Shift it back.
      await user.keyboard('[ShiftLeft>][ArrowLeft][/ShiftLeft]');

      // Verify that it was indented in storage.
      expectedFile.groups[0].checklists[0].items[0].indent = 0;
      await expectFile('My file', expectedFile);
    });

    it('should center an item', async () => {
      await newFile('My file');
      await user.click(screen.getByRole('treeitem', { name: 'Checklist: First checklist' }));
      // We can't use the built-in item because challenge/response doesn't support centering.
      await addItem('caution', 'Center me');

      // Select and shift the item.
      await user.keyboard('[ArrowUp]');
      await debounce();
      await user.keyboard('[ShiftLeft>]c[/ShiftLeft]');
      await debounce();

      // Verify that it was centered in storage.
      const expectedFile = ChecklistFile.clone(NEW_FILE);
      expectedFile.groups[0].checklists[0].items.push(
        ChecklistItem.create({
          type: ChecklistItem_Type.ITEM_CAUTION,
          prompt: 'Center me',
          centered: true,
        }),
      );
      await expectFile('My file', expectedFile);

      // Uncenter it.
      await user.keyboard('[ShiftLeft>]c[/ShiftLeft]');

      // Verify that it was indented in storage.
      expectedFile.groups[0].checklists[0].items[1].centered = false;
      await expectFile('My file', expectedFile);
    });

    it('should delete an item', async () => {
      await newFile('My file');
      await user.click(screen.getByRole('treeitem', { name: 'Checklist: First checklist' }));

      // Add an item.
      await debounce();
      await user.keyboard('nw');
      await debounce();

      expect(await screen.findByRole('listitem', { name: 'Item: New item' })).toBeInTheDocument();

      // Delete it.
      await user.keyboard('[Delete]');
      expect(screen.queryByRole('listitem', { name: 'Item: New item' })).not.toBeInTheDocument();

      // Verify that it's gone from storage.
      await expectFile('My file', NEW_FILE);

      // Also delete the other that was already there (it should have been selected after the other was deleted).
      expect(screen.getByRole('listitem', { name: 'Item: Checklist created' })).toBeInTheDocument();
      await user.keyboard('[Delete]');
      expect(screen.queryByRole('listitem', { name: 'Item: Checklist created' })).not.toBeInTheDocument();

      // Verify that it's also gone from storage.
      const expectedFile = ChecklistFile.clone(NEW_FILE);
      expectedFile.groups[0].checklists[0].items = [];
      await expectFile('My file', expectedFile);
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
      await user.click(screen.getByRole('treeitem', { name: 'Checklist: First checklist' }));
      await addItem('caution', 'Second item');
      await addItem('title', 'Third item');

      const item1 = ChecklistItem.clone(NEW_FILE.groups[0].checklists[0].items[0]);
      const item2 = ChecklistItem.create({
        type: ChecklistItem_Type.ITEM_CAUTION,
        prompt: 'Second item',
      });
      const item3 = ChecklistItem.create({
        type: ChecklistItem_Type.ITEM_TITLE,
        prompt: 'Third item',
      });

      // Shift first item down
      await user.keyboard('[ArrowDown]');
      await debounce();
      await user.keyboard('[ShiftLeft>][ArrowDown][/ShiftLeft]');
      await debounce();

      const expectedFile = ChecklistFile.clone(NEW_FILE);
      const checklist = expectedFile.groups[0].checklists[0];
      checklist.items = [item2, item1, item3];
      await expectFile('My file', expectedFile);

      // Shift it again
      await user.keyboard('[ShiftLeft>][ArrowDown][/ShiftLeft]');
      await debounce();

      checklist.items = [item2, item3, item1];
      await expectFile('My file', expectedFile);

      // Shift it again, even though it's already at the bottom
      await user.keyboard('[ShiftLeft>][ArrowDown][/ShiftLeft]');
      await debounce();
      await expectFile('My file', expectedFile);

      // Shift it up
      await user.keyboard('[ShiftLeft>][ArrowUp][/ShiftLeft]');
      await debounce();

      checklist.items = [item2, item1, item3];
      await expectFile('My file', expectedFile);

      // Shift it up again
      await user.keyboard('[ShiftLeft>][ArrowUp][/ShiftLeft]');
      await debounce();

      checklist.items = [item1, item2, item3];
      await expectFile('My file', expectedFile);

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

      const expectedFile = (await getChecklistFile('My file'))!;
      expectedFile.metadata!.modifiedTime = 0;
      const checklist1 = expectedFile.groups[0].checklists[0];
      const checklist2 = expectedFile.groups[0].checklists[1];
      const checklist3 = expectedFile.groups[1].checklists[0];

      // Move the last checklist up.
      await user.keyboard(`[ShiftLeft>][${metaKey}>][ArrowUp][/${metaKey}][/ShiftLeft]`);
      expectFragment('My file/0/2');
      expectedFile.groups[0].checklists = [checklist1, checklist2, checklist3];
      expectedFile.groups[1].checklists = [];
      await expectFile('My file', expectedFile);

      await user.keyboard(`[ShiftLeft>][${metaKey}>][ArrowUp][/${metaKey}][/ShiftLeft]`);
      expectFragment('My file/0/1');
      expectedFile.groups[0].checklists = [checklist1, checklist3, checklist2];
      await expectFile('My file', expectedFile);

      await user.keyboard(`[ShiftLeft>][${metaKey}>][ArrowUp][/${metaKey}][/ShiftLeft]`);
      expectFragment('My file/0/0');
      expectedFile.groups[0].checklists = [checklist3, checklist1, checklist2];
      await expectFile('My file', expectedFile);

      // Move it past the top and assert no change.
      await user.keyboard(`[ShiftLeft>][${metaKey}>][ArrowUp][/${metaKey}][/ShiftLeft]`);
      expectFragment('My file/0/0');
      await expectFile('My file', expectedFile);

      // Move it back down.
      await user.keyboard(`[ShiftLeft>][${metaKey}>][ArrowDown][/${metaKey}][/ShiftLeft]`);
      expectFragment('My file/0/1');
      expectedFile.groups[0].checklists = [checklist1, checklist3, checklist2];
      await expectFile('My file', expectedFile);

      await user.keyboard(`[ShiftLeft>][${metaKey}>][ArrowDown][/${metaKey}][/ShiftLeft]`);
      expectFragment('My file/0/2');
      expectedFile.groups[0].checklists = [checklist1, checklist2, checklist3];
      await expectFile('My file', expectedFile);

      await user.keyboard(`[ShiftLeft>][${metaKey}>][ArrowDown][/${metaKey}][/ShiftLeft]`);
      expectFragment('My file/1/0');
      expectedFile.groups[0].checklists = [checklist1, checklist2];
      expectedFile.groups[1].checklists = [checklist3];
      await expectFile('My file', expectedFile);

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

      const expectedFile = (await getChecklistFile('My file'))!;
      expectedFile.metadata!.modifiedTime = 0;
      const group1 = expectedFile.groups[0];
      const group2 = expectedFile.groups[1];
      const group3 = expectedFile.groups[2];

      await user.click(screen.getByRole('treeitem', { name: 'Checklist: Second checklist' }));
      expectFragment('My file/0/1');

      // Move the first group down.
      await user.keyboard('[ShiftLeft>][AltLeft>][ArrowDown][/AltLeft][/ShiftLeft]');
      expectFragment('My file/1/1');
      expectedFile.groups = [group2, group1, group3];
      await expectFile('My file', expectedFile);

      await user.keyboard('[ShiftLeft>][AltLeft>][ArrowDown][/AltLeft][/ShiftLeft]');
      expectFragment('My file/2/1');
      expectedFile.groups = [group2, group3, group1];
      await expectFile('My file', expectedFile);

      // Move it past the bottom and assert no change.
      await user.keyboard('[ShiftLeft>][AltLeft>][ArrowDown][/AltLeft][/ShiftLeft]');
      expectFragment('My file/2/1');
      await expectFile('My file', expectedFile);

      // Move it back up.
      await user.keyboard('[ShiftLeft>][AltLeft>][ArrowUp][/AltLeft][/ShiftLeft]');
      expectFragment('My file/1/1');
      expectedFile.groups = [group2, group1, group3];
      await expectFile('My file', expectedFile);

      await user.keyboard('[ShiftLeft>][AltLeft>][ArrowUp][/AltLeft][/ShiftLeft]');
      expectFragment('My file/0/1');
      expectedFile.groups = [group1, group2, group3];
      await expectFile('My file', expectedFile);

      // Move it past the top and assert no change.
      await user.keyboard('[ShiftLeft>][AltLeft>][ArrowUp][/AltLeft][/ShiftLeft]');
      expectFragment('My file/0/1');
      await expectFile('My file', expectedFile);
    });
  });
});
