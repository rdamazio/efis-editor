import { DeferBlockState, inject } from '@angular/core/testing';
import { render, RenderResult, screen, within } from '@testing-library/angular';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { ChecklistFile, ChecklistItem_Type } from '../../../gen/ts/checklist';
import { EXPECTED_CONTENTS } from '../../model/formats/test-data';
import { LazyBrowserStorage } from '../../model/storage/browser-storage';
import { ChecklistStorage } from '../../model/storage/checklist-storage';
import { ChecklistsComponent } from './checklists.component';

describe('ChecklistsComponent', () => {
  let user: UserEvent;
  let rendered: RenderResult<ChecklistsComponent>;
  let storage: ChecklistStorage;

  beforeEach(async () => {
    user = userEvent.setup();

    rendered = await render(ChecklistsComponent);

    // Force rendering of all deferred blocks before we start interacting.
    const deferredBlocks = await rendered.fixture.getDeferBlocks();
    for (const deferredBlock of deferredBlocks) {
      await deferredBlock.render(DeferBlockState.Complete);
    }
  });

  beforeEach(inject(
    [ChecklistStorage, LazyBrowserStorage],
    async (s: ChecklistStorage, browserStore: LazyBrowserStorage) => {
      storage = s;
      browserStore.forceBrowserStorage();

      await storage.clear();
    },
  ));

  afterEach(async () => {
    await storage.clear();
  });

  async function newEmptyFile(fileName: string) {
    // Create new file
    await user.click(screen.getByRole('button', { name: 'New file' }));
    const checklistTitleBox = await screen.findByRole('textbox', { name: 'Title' });
    await user.type(checklistTitleBox, `${fileName}[Enter]`);

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

  it('should create a new checklist and populate it', async () => {
    const file = ChecklistFile.clone(EXPECTED_CONTENTS);
    const metadata = file.metadata!;
    const fileName = metadata.name;

    const typeMap = new Map<ChecklistItem_Type, string>();
    for (const type of ChecklistsComponent.NEW_ITEM_SHORTCUTS) {
      typeMap.set(type.type, type.typeDescription);
    }

    await newEmptyFile(fileName);

    // Add every item on the test file.
    let numBlanks = 0;
    for (const group of file.groups) {
      await addGroup(group.title);

      for (const checklist of group.checklists) {
        await addChecklist(group.title, checklist.title);
        await user.click(screen.getByRole('treeitem', { name: `Checklist: ${checklist.title}` }));

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

    const checklist = await storage.getChecklistFile(file.metadata!.name);
    expect(checklist).not.toBeNull();

    // Don't compare mtimes.
    checklist!.metadata!.modifiedTime = 0;

    expect(checklist).toEqual(EXPECTED_CONTENTS);
  }, 20000); // Longer timeout for this large test.

  // TODO: Test renaming a checklist and group.
  // await user.hover(screen.getByText('First checklist'));
  // const checklist1 = screen.getByRole('treeitem', { name: 'Checklist: First checklist' });
  // await user.click(within(checklist1).getByRole('button', { name: 'Rename First checklist' }));

  // const titleBox = await screen.findByRole('textbox', { name: 'Title' });
  // await user.clear(titleBox);
  // await user.type(titleBox, 'Renamed checklist[Enter]');

  // TODO: Test deleting an item, checklist and group.
  // await user.hover(screen.getByText('First checklist'));
  // const checklist1 = screen.getByRole('treeitem', { name: 'Checklist: First checklist' });
  // await user.click(within(checklist1).getByRole('button', { name: 'Delete First checklist' }));
  // const checklistConfirmButton = await screen.findByRole('button', { name: 'Delete!' });
  // user.click(checklistConfirmButton);
});
