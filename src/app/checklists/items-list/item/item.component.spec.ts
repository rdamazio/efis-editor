import { render, screen } from '@testing-library/angular';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { ChecklistItem, ChecklistItem_Type } from '../../../../../gen/ts/checklist';
import { ChecklistItemComponent } from './item.component';

describe('ChecklistItemComponent', () => {
  let user: UserEvent;
  let itemChange: jasmine.Spy<(value: ChecklistItem) => void>;
  let itemDeleted: jasmine.Spy<(value: boolean) => void>;
  let editButton: HTMLButtonElement;
  let deleteButton: HTMLButtonElement;
  let indentLeftButton: HTMLButtonElement;
  let indentRightButton: HTMLButtonElement;
  let centerButton: HTMLButtonElement;
  let item: ChecklistItem;

  beforeEach(() => {
    user = userEvent.setup();
    itemChange = jasmine.createSpy('itemChange');
    itemDeleted = jasmine.createSpy('itemDeleted');

    item = ChecklistItem.create({ prompt: 'My prompt', type: ChecklistItem_Type.ITEM_PLAINTEXT });
  });

  async function renderComponent() {
    await render(ChecklistItemComponent, {
      inputs: { item: item },
      on: { itemChange, itemDeleted },
    });

    editButton = screen.queryByRole('button', { name: /Edit.*/ })!;
    deleteButton = screen.queryByRole('button', { name: /Delete.*/ })!;
    indentLeftButton = screen.queryByRole('button', { name: /Indent.*left/ })!;
    indentRightButton = screen.queryByRole('button', { name: /Indent.*right/ })!;
    centerButton = screen.queryByRole('button', { name: /Center.*/ })!;
  }

  it('should render', async () => {
    await renderComponent();

    expect(screen.queryByText('My prompt')).toBeVisible();
  });

  it('should edit a single-text item', async () => {
    await renderComponent();

    expect(editButton).toBeVisible();
    expect(editButton).toBeEnabled();
    await user.click(editButton!);

    const editBox = await screen.findByRole('textbox', { name: 'Prompt text' });
    expect(editBox).toBeVisible();
    expect(editBox).toHaveValue('My prompt');
    expect(screen.queryByRole('textbox', { name: 'Expectation text' })).not.toBeInTheDocument();

    await user.type(editBox, ' was modified');
    expect(editBox).toHaveValue('My prompt was modified');
    await user.type(editBox, '[Enter]');

    expect(itemChange).toHaveBeenCalledOnceWith(item);
    expect(item.prompt).toEqual('My prompt was modified');
  });

  it('should not be able to enter forbidden characters when editing', async () => {
    await renderComponent();

    await user.click(editButton!);

    const editBox = await screen.findByRole('textbox', { name: 'Prompt text' });
    expect(editBox).toHaveValue('My prompt');

    await user.type(editBox, ' had ~ as an invalid character');
    expect(editBox).toHaveValue('My prompt had  as an invalid character');
    await user.type(editBox, '[Enter]');

    expect(itemChange).toHaveBeenCalledOnceWith(item);
    expect(item.prompt).toEqual('My prompt had  as an invalid character');
  });

  it('should edit a challenge/response item', async () => {
    item.type = ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE;
    item.expectation = 'My expectation';
    await renderComponent();

    expect(editButton).toBeVisible();
    expect(editButton).toBeEnabled();
    await user.click(editButton!);

    const promptBox = await screen.findByRole('textbox', { name: 'Prompt text' });
    expect(promptBox).toBeVisible();
    expect(promptBox).toHaveValue('My prompt');
    const expectationBox = await screen.findByRole('textbox', { name: 'Expectation text' });
    expect(expectationBox).toBeVisible();
    expect(expectationBox).toHaveValue('My expectation');

    await user.type(promptBox, ' was modified');
    await user.type(expectationBox, ' was modified too');
    expect(promptBox).toHaveValue('My prompt was modified');
    expect(expectationBox).toHaveValue('My expectation was modified too');
    await user.type(expectationBox, '[Enter]');

    expect(itemChange).toHaveBeenCalledWith(item);
    expect(item.prompt).toEqual('My prompt was modified');
    expect(item.expectation).toEqual('My expectation was modified too');
  });

  it('should not emit when an edit is cancelled', async () => {
    item.type = ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE;
    item.expectation = 'My expectation';
    await renderComponent();

    expect(editButton).toBeVisible();
    expect(editButton).toBeEnabled();
    await user.click(editButton!);

    const promptBox = await screen.findByRole('textbox', { name: 'Prompt text' });
    expect(promptBox).toBeVisible();
    expect(promptBox).toHaveValue('My prompt');
    const expectationBox = await screen.findByRole('textbox', { name: 'Expectation text' });
    expect(expectationBox).toBeVisible();
    expect(expectationBox).toHaveValue('My expectation');

    await user.type(promptBox, ' was modified');
    await user.type(expectationBox, ' was modified too');
    expect(promptBox).toHaveValue('My prompt was modified');
    expect(expectationBox).toHaveValue('My expectation was modified too');
    await user.type(expectationBox, '[Escape]');

    expect(itemChange).not.toHaveBeenCalled();
    expect(item.prompt).toEqual('My prompt');
    expect(item.expectation).toEqual('My expectation');
  });

  it('should not be able to edit but able to indent a blank item', async () => {
    item.type = ChecklistItem_Type.ITEM_SPACE;
    item.prompt = '';
    await renderComponent();

    expect(editButton).toBeVisible();
    expect(editButton).toBeDisabled();
    expect(centerButton).toBeDisabled();
    expect(indentLeftButton).toBeDisabled();
    expect(indentRightButton).toBeEnabled();
  });

  it('should emit when Delete is clicked', async () => {
    await renderComponent();

    expect(deleteButton).toBeVisible();
    expect(deleteButton).toBeEnabled();
    await user.click(deleteButton!);

    expect(itemDeleted).toHaveBeenCalledOnceWith(true);
  });

  it('should toggle centered', async () => {
    item.indent = 1;
    await renderComponent();

    expect(centerButton).toBeEnabled();
    expect(centerButton.textContent).toContain('format_align_center');
    expect(indentLeftButton).toBeEnabled();
    expect(indentRightButton).toBeEnabled();

    await user.click(centerButton);

    expect(centerButton).toBeEnabled();
    expect(centerButton.textContent).toContain('format_align_left');
    expect(indentLeftButton).toBeDisabled();
    expect(indentRightButton).toBeDisabled();

    expect(itemChange).toHaveBeenCalledOnceWith(item);
    expect(item.centered).toBeTrue();
    expect(item.indent).toEqual(0);

    await user.click(centerButton);

    expect(centerButton).toBeEnabled();
    expect(centerButton.textContent).toContain('format_align_center');
    expect(indentLeftButton).toBeDisabled();
    expect(indentRightButton).toBeEnabled();

    expect(itemChange).toHaveBeenCalledTimes(2);
    expect(item.centered).toBeFalse();
  });

  it('should indent left/right', async () => {
    item.indent = 0;
    await renderComponent();

    expect(indentLeftButton).toBeDisabled();
    expect(indentRightButton).toBeEnabled();

    // Indent right 3 times
    for (let i = 1; i < 4; i++) {
      await user.click(indentRightButton);

      expect(indentLeftButton).toBeEnabled();
      expect(indentRightButton).toBeEnabled();

      expect(itemChange).toHaveBeenCalledTimes(i);
      expect(item.indent).toEqual(i);
    }

    // 4th time reaches the limit, so button gets disabled.
    await user.click(indentRightButton);

    expect(indentLeftButton).toBeEnabled();
    expect(indentRightButton).toBeDisabled();

    expect(itemChange).toHaveBeenCalledTimes(4);
    expect(item.indent).toEqual(4);

    // Indent left 3 times.
    for (let i = 1; i < 4; i++) {
      await user.click(indentLeftButton);

      expect(indentLeftButton).toBeEnabled();
      expect(indentRightButton).toBeEnabled();

      expect(itemChange).toHaveBeenCalledTimes(4 + i);
      expect(item.indent).toEqual(4 - i);
    }

    // 4th time reaches the limit, so button gets disabled.
    await user.click(indentLeftButton);

    expect(indentLeftButton).toBeDisabled();
    expect(indentRightButton).toBeEnabled();

    expect(itemChange).toHaveBeenCalledTimes(8);
    expect(item.indent).toEqual(0);
  });
});
