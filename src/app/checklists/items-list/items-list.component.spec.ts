import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { render, screen, within } from '@testing-library/angular';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { Checklist, ChecklistItem_Type } from '../../../../gen/ts/checklist';
import { EXPECTED_CONTENTS } from '../../../model/formats/test-data';
import { ChecklistItemsComponent } from './items-list.component';

describe('ChecklistItemsComponent', () => {
  let user: UserEvent;
  let checklist: Checklist;
  let checklistChange: jasmine.Spy;

  beforeEach(async () => {
    user = userEvent.setup();
    checklist = Checklist.clone(EXPECTED_CONTENTS.groups[0].checklists[0]);
    checklistChange = jasmine.createSpy('checklistChange').and.callFake((newChecklist: Checklist) => {
      checklist = newChecklist;
    });

    await render(ChecklistItemsComponent, {
      imports: [NoopAnimationsModule],
      inputs: { checklist },
      on: { checklistChange },
    });
  });

  it('should render', async () => {
    // jasmine itself adds a list of tests to the page, so we have to restrict to our own.
    const list = screen.getByTestId('items-list');
    // Get all of them so we can assert ordering.
    const items = await within(list).findAllByRole('listitem');
    for (const item of items) {
      expect(item).toBeVisible();
    }
    const textContents = items.map((item: HTMLElement) =>
      item.textContent.replace(/drag_.*format_align_[a-z]+/, '').trim(),
    );
    expect(textContents).toHaveSize(18);
    expect(textContents[0]).toEqual('Challenge item');
    expect(textContents[1]).toMatch(/Challenge item 2\s+Item response/);
    expect(textContents[2]).toEqual('Plain text item');
    expect(textContents[3]).toEqual('Note item');
    expect(textContents[4]).toEqual('Subtitle item');
    expect(textContents[5]).toEqual('Warning item');
    expect(textContents[6]).toEqual('Caution item');
    expect(textContents[7]).toEqual('Item with 1 blank line');
    expect(textContents[8]).toEqual('');
    expect(textContents[9]).toEqual('Item with 2 blank lines');
    expect(textContents[8]).toEqual('');
    expect(textContents[8]).toEqual('');
    expect(textContents[12]).toMatch(
      /Item with a very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long text\s*Response with a very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long text/,
    );
    expect(textContents[13]).toEqual('Item with indent 1');
    expect(textContents[14]).toEqual('Item with indent 2');
    expect(textContents[15]).toEqual('Item with indent 3');
    expect(textContents[16]).toEqual('Item with indent 4');
    expect(textContents[17]).toEqual('Centered item');
  });

  it('should emit when an item is changed', async () => {
    const item = screen.getByRole('listitem', { name: 'Item: Caution item' });

    const editButton = within(item).getByRole('button', { name: 'Edit Caution item' });
    await user.click(editButton);
    const editBox = await within(item).findByRole('textbox', { name: 'Prompt text' });
    await user.type(editBox, ' modified[Enter]');

    expect(await screen.findByRole('listitem', { name: 'Item: Caution item modified' })).toBeVisible();
    expect(checklist.items[6].prompt).toEqual('Caution item modified');
    expect(checklistChange).toHaveBeenCalledOnceWith(checklist);
  });

  it('should add a challenge item', async () => {
    const origSize = checklist.items.length;
    const addButton = screen.getByRole('button', { name: 'Add a new checklist challenge' });
    await user.click(addButton);
    expect(checklist.items).toHaveSize(origSize + 1);

    const newItem = checklist.items[origSize];
    expect(newItem.type).toEqual(ChecklistItem_Type.ITEM_CHALLENGE);
    expect(newItem.prompt).toEqual('New item');
    expect(newItem.expectation).toEqual('');
    expect(checklistChange).toHaveBeenCalledOnceWith(checklist);
  });

  it('should add a challenge/response item', async () => {
    const origSize = checklist.items.length;
    const addButton = screen.getByRole('button', { name: 'Add a new checklist challenge/response' });
    await user.click(addButton);
    expect(checklist.items).toHaveSize(origSize + 1);

    const newItem = checklist.items[origSize];
    expect(newItem.type).toEqual(ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE);
    expect(newItem.prompt).toEqual('New item');
    expect(newItem.expectation).toEqual('New expectation');
    expect(checklistChange).toHaveBeenCalledOnceWith(checklist);
  });

  it('should add a plaintext item', async () => {
    const origSize = checklist.items.length;
    const addButton = screen.getByRole('button', { name: 'Add a new checklist text' });
    await user.click(addButton);
    expect(checklist.items).toHaveSize(origSize + 1);

    const newItem = checklist.items[origSize];
    expect(newItem.type).toEqual(ChecklistItem_Type.ITEM_PLAINTEXT);
    expect(newItem.prompt).toEqual('New item');
    expect(newItem.expectation).toEqual('');
    expect(checklistChange).toHaveBeenCalledOnceWith(checklist);
  });

  it('should add a note item', async () => {
    const origSize = checklist.items.length;
    const addButton = screen.getByRole('button', { name: 'Add a new checklist note' });
    await user.click(addButton);
    expect(checklist.items).toHaveSize(origSize + 1);

    const newItem = checklist.items[origSize];
    expect(newItem.type).toEqual(ChecklistItem_Type.ITEM_NOTE);
    expect(newItem.prompt).toEqual('New item');
    expect(newItem.expectation).toEqual('');
    expect(checklistChange).toHaveBeenCalledOnceWith(checklist);
  });

  it('should add a title item', async () => {
    const origSize = checklist.items.length;
    const addButton = screen.getByRole('button', { name: 'Add a new checklist title' });
    await user.click(addButton);
    expect(checklist.items).toHaveSize(origSize + 1);

    const newItem = checklist.items[origSize];
    expect(newItem.type).toEqual(ChecklistItem_Type.ITEM_TITLE);
    expect(newItem.prompt).toEqual('New item');
    expect(newItem.expectation).toEqual('');
    expect(checklistChange).toHaveBeenCalledOnceWith(checklist);
  });

  it('should add a warning item', async () => {
    const origSize = checklist.items.length;
    const addButton = screen.getByRole('button', { name: 'Add a new checklist warning' });
    await user.click(addButton);
    expect(checklist.items).toHaveSize(origSize + 1);

    const newItem = checklist.items[origSize];
    expect(newItem.type).toEqual(ChecklistItem_Type.ITEM_WARNING);
    expect(newItem.prompt).toEqual('New item');
    expect(newItem.expectation).toEqual('');
    expect(checklistChange).toHaveBeenCalledOnceWith(checklist);
  });

  it('should add a caution item', async () => {
    const origSize = checklist.items.length;
    const addButton = screen.getByRole('button', { name: 'Add a new checklist caution' });
    await user.click(addButton);
    expect(checklist.items).toHaveSize(origSize + 1);

    const newItem = checklist.items[origSize];
    expect(newItem.type).toEqual(ChecklistItem_Type.ITEM_CAUTION);
    expect(newItem.prompt).toEqual('New item');
    expect(newItem.expectation).toEqual('');
    expect(checklistChange).toHaveBeenCalledOnceWith(checklist);
  });

  it('should add a blank item', async () => {
    const origSize = checklist.items.length;
    const addButton = screen.getByRole('button', { name: 'Add a new checklist blank row' });
    await user.click(addButton);
    expect(checklist.items).toHaveSize(origSize + 1);

    const newItem = checklist.items[origSize];
    expect(newItem.type).toEqual(ChecklistItem_Type.ITEM_SPACE);
    expect(newItem.prompt).toEqual('');
    expect(newItem.expectation).toEqual('');
    expect(checklistChange).toHaveBeenCalledOnceWith(checklist);
  });

  it('should delete an item', async () => {
    const item = screen.getByRole('listitem', { name: 'Item: Warning item' });

    const deleteButton = within(item).getByRole('button', { name: 'Delete Warning item' });
    await user.click(deleteButton);

    expect(screen.queryByRole('listitem', { name: 'Item: Warning item' })).not.toBeInTheDocument();

    expect(checklist.items).toHaveSize(17);
    expect(checklist.items[5].prompt).toEqual('Caution item');
    expect(checklistChange).toHaveBeenCalledOnceWith(checklist);
  });

  it('should undo item deletion', async () => {
    const item = screen.getByRole('listitem', { name: 'Item: Warning item' });

    const deleteButton = within(item).getByRole('button', { name: 'Delete Warning item' });
    await user.click(deleteButton);

    expect(screen.queryByRole('listitem', { name: 'Item: Warning item' })).not.toBeInTheDocument();
    expect(checklist.items).toHaveSize(17);

    const undoButton = await screen.findByRole('button', { name: 'Undo', hidden: true });
    expect(undoButton).toBeVisible();
    await user.click(undoButton);

    expect(await screen.findByRole('listitem', { name: 'Item: Warning item' })).toBeVisible();

    expect(checklist.items).toHaveSize(18);
    expect(checklist.items[5].prompt).toEqual('Warning item');

    expect(checklistChange).toHaveBeenCalledTimes(2);
  });
});
