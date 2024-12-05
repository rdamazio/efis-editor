import { DeferBlockState, inject } from '@angular/core/testing';
import { render, RenderResult, screen, within } from '@testing-library/angular';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { ChecklistFile, ChecklistItem_Type } from '../../../gen/ts/checklist';
import { EXPECTED_CONTENTS } from '../../model/formats/test-data';
import { ChecklistStorage } from '../../model/storage/checklist-storage';
import { ChecklistsComponent } from './checklists.component';
import { LazyBrowserStorage } from '../../model/storage/browser-storage';

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

  beforeEach(inject([ChecklistStorage, LazyBrowserStorage], (s: ChecklistStorage, browserStore: LazyBrowserStorage) => {
    storage = s;
    browserStore.forceBrowserStorage();
  }));

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
    const item = screen.getByRole('listitem', { name: 'Item: New item' });
    await user.click(within(item).getByRole('button', { name: 'Edit New item' }));
    if (prompt) {
      const itemPromptBox = await within(item).findByRole('textbox', { name: 'Prompt text' });
      await user.clear(itemPromptBox);
      await user.type(itemPromptBox, prompt);
    }
    if (expectation) {
      const itemExpectationBox = await within(item).findByRole('textbox', { name: 'Expectation text' });
      await user.clear(itemExpectationBox);
      await user.type(itemExpectationBox, expectation);
    }
    await user.click(within(item).getByRole('button', { name: 'Save changes to Prompt text' }));
  }

  it('should create a new checklist and populate it', async () => {
    const file = ChecklistFile.clone(EXPECTED_CONTENTS);
    const fileName = file.metadata!.name;
    const group1 = file.groups[0].title;
    const group1checklist1 = file.groups[0].checklists[0].title;
    const checklist1 = file.groups[0].checklists[0];
    const checklist1item1 = checklist1.items[0].prompt;
    const checklist1item2 = checklist1.items[1].prompt;
    const checklist1item2resp = checklist1.items[1].expectation;

    await newEmptyFile(fileName);
    await addGroup(group1);
    await addChecklist(group1, group1checklist1);

    await user.click(screen.getByRole('treeitem', { name: `Checklist: ${group1checklist1}` }));

    await addItem('challenge', checklist1item1);
    await addItem('challenge/response', checklist1item2, checklist1item2resp);

    // TODO: Populate all of file (that'll comprehensively test the UI), then compare to it.
    const checklist = await storage.getChecklistFile(file.metadata!.name);
    expect(checklist).not.toBeNull();
    expect(checklist!.groups).toHaveSize(1);
    expect(checklist!.groups[0].checklists[0].title).toEqual(group1checklist1);
    expect(checklist!.groups[0].checklists[0].items).toHaveSize(2);
    expect(checklist!.groups[0].checklists[0].items[0].type).toEqual(ChecklistItem_Type.ITEM_CHALLENGE);
    expect(checklist!.groups[0].checklists[0].items[0].prompt).toEqual(checklist1item1);
    expect(checklist!.groups[0].checklists[0].items[1].type).toEqual(ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE);
    expect(checklist!.groups[0].checklists[0].items[1].prompt).toEqual(checklist1item2);
    expect(checklist!.groups[0].checklists[0].items[1].expectation).toEqual(checklist1item2resp);
  });

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
