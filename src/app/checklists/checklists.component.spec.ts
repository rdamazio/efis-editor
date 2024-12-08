import { DeferBlockState, inject } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NavigationExtras, Router } from '@angular/router';
import { render, RenderResult, screen, within } from '@testing-library/angular';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { ChecklistFile, ChecklistGroup_Category, ChecklistItem_Type } from '../../../gen/ts/checklist';
import { EXPECTED_CONTENTS } from '../../model/formats/test-data';
import { LazyBrowserStorage } from '../../model/storage/browser-storage';
import { ChecklistStorage } from '../../model/storage/checklist-storage';
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let realNavigate: (commands: any[], extras?: NavigationExtras) => Promise<boolean>;

  beforeEach(async () => {
    // We have a lot of large tests in this file, override the timeout.
    // (for one, MatSnackBar delays play out in realtime).
    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;

    user = userEvent.setup();

    rendered = await render(ChecklistsComponent);

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

    // Add every item on the test file.
    let numBlanks = 0;
    for (const [groupIdx, group] of file.groups.entries()) {
      await addGroup(group.title);

      for (const [checklistIdx, checklist] of group.checklists.entries()) {
        await addChecklist(group.title, checklist.title);
        await user.click(screen.getByRole('treeitem', { name: `Checklist: ${checklist.title}` }));

        expectFragment(`${fileName}/${groupIdx}/${checklistIdx}`);

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
    expect(screen.getByRole('treeitem', { name: 'Checklist: First checklist' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete file' }));
    const confirmButton = await screen.findByRole('button', { name: 'Delete!' });
    expect(confirmButton).toBeVisible();
    await user.click(confirmButton);

    expect(screen.queryByRole('treeitem', { name: 'Checklist: First checklist' })).not.toBeInTheDocument();
    expect(await getChecklistFile('My file')).toBeNull();
    expectFragment('');
  });

  it('should create and rename a file', async () => {
    await newFile('My file');
    expect(await getChecklistFile('My file')).not.toBeNull();
    expectFragment('My file');

    await user.click(screen.getByRole('button', { name: 'Open file information dialog' }));
    const nameBox = await screen.findByRole('textbox', { name: 'File name' });
    await retype(nameBox, 'Renamed file');

    const okButton = await screen.findByRole('button', { name: 'Ok' });
    await user.click(okButton);

    expect(await getChecklistFile('My file')).toBeNull();
    expect(await getChecklistFile('Renamed file')).not.toBeNull();

    // TODO: Actual bug - fix.
    // expectFragment('Renamed file');
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
    expect(screen.getByRole('treeitem', { name: 'Checklist: First checklist' })).toBeInTheDocument();

    await setFragment('');
    expect(screen.queryByRole('treeitem', { name: 'Checklist: First checklist' })).not.toBeInTheDocument();

    await setFragment('My file');
    expect(await screen.findByRole('treeitem', { name: 'Checklist: First checklist' })).toBeInTheDocument();
  });

  it('should handle a URL fragment with a bad filename', async () => {
    await setFragment('Non-existing file');

    expect(screen.queryByRole('treeitem', { name: /Checklist:/ })).not.toBeInTheDocument();
    expect(lastSnackMessage()).toMatch(/Failed to load.*/);
  });

  it('should handle a URL fragment with a bad group number', async () => {
    await newFile('My file');
    expectFragment('My file');

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

    await setFragment('My file/0/2');
    expect(lastSnackMessage()).toMatch(/.*has no checklist 2.*/);

    // Switching back to a correct URL still works.
    await setFragment('My file/0/0');
    expect(screen.getByRole('listitem', { name: 'Item: Checklist created' })).toBeInTheDocument();
  });

  it('should handle a URL fragment with the wrong format', async () => {
    await newFile('My file');
    expectFragment('My file');

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

  // TODO: Add keyboard shortcut tests.
});
