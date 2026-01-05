import { inputBinding, outputBinding, signal, twoWayBinding, WritableSignal } from '@angular/core';
import { render, RenderResult, screen, waitFor } from '@testing-library/angular';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { Mock } from 'vitest';
import { SearchComponent } from './search.component';

describe('SearchComponent', () => {
  let user: UserEvent;
  let rendered: RenderResult<SearchComponent>;
  let query: WritableSignal<string>;
  let totalMatches: WritableSignal<number>;
  let currentMatch: WritableSignal<number | undefined>;
  let cancel: Mock<() => void>;

  beforeEach(async () => {
    user = userEvent.setup();

    query = signal('');
    totalMatches = signal(0);
    currentMatch = signal(0);
    cancel = vi.fn<() => void>();
    rendered = await render(SearchComponent, {
      bindings: [
        twoWayBinding('query', query),
        inputBinding('totalMatches', totalMatches),
        twoWayBinding('currentMatch', currentMatch),
        outputBinding('cancel', cancel),
      ],
    });
  });

  it('should create', () => {
    expect(screen.getByRole('textbox', { name: 'Search terms' })).toBeVisible();
  });

  it('should emit cancel on escape key', async () => {
    const queryBox = screen.getByRole('textbox', { name: 'Search terms' });
    await user.type(queryBox, '[Escape]');

    expect(cancel).toHaveBeenCalled();
  });

  it('should emit cancel on close button click', async () => {
    const closeButton = screen.getByRole('button', { name: 'Close search' });
    await user.click(closeButton);

    expect(cancel).toHaveBeenCalled();
  });

  it('should populate the search input with the provided query', async () => {
    query.set('My query');

    await expect(screen.findByRole('textbox', { name: 'Search terms' })).resolves.toHaveValue('My query');
  });

  it('modifying the search terms should output them immediately', async () => {
    const searchBox = screen.getByRole('textbox', { name: 'Search terms' });
    await user.type(searchBox, 'My query');

    expect(query()).toBe('My query');
  });

  it('buttons should only show up when a query has been entered', async () => {
    const searchBox = screen.getByRole('textbox', { name: 'Search terms' });

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Next match' })).not.toBeInTheDocument());
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Previous match' })).not.toBeInTheDocument());

    await user.type(searchBox, 'My query');
    const nextButton = await screen.findByRole('button', { name: 'Next match' });
    const prevButton = await screen.findByRole('button', { name: 'Previous match' });

    expect(nextButton).toBeVisible();
    expect(prevButton).toBeVisible();

    await user.clear(searchBox);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Next match' })).not.toBeInTheDocument());
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Previous match' })).not.toBeInTheDocument());
  });

  it('result count should show only when a query has been entered', async () => {
    const searchBox = screen.getByRole('textbox', { name: 'Search terms' });

    await waitFor(() => expect(screen.queryByText(/\d+ \/ \d+/)).not.toBeInTheDocument());

    await user.type(searchBox, 'My query');

    await expect(screen.findByText(/\d+ \/ \d+/)).resolves.toBeVisible();

    await user.clear(searchBox);
    await waitFor(() => expect(screen.queryByText(/\d+ \/ \d+/)).not.toBeInTheDocument());
  });

  it('should show the total number of matches', async () => {
    const searchBox = screen.getByRole('textbox', { name: 'Search terms' });
    await user.type(searchBox, 'My query');
    totalMatches.set(5);

    // It should show 0/5 because at this point we haven't yet moved to the first match.
    await expect(screen.findByText('0 / 5')).resolves.toBeVisible();
    expect(currentMatch()).toBeUndefined();

    currentMatch.set(0);

    await expect(screen.findByText('1 / 5')).resolves.toBeVisible();
    expect(currentMatch()).toBe(0);
  });

  it('should update current match on Next click', async () => {
    const searchBox = screen.getByRole('textbox', { name: 'Search terms' });
    await user.type(searchBox, 'My query');

    expect(query()).toBe('My query');

    totalMatches.set(4);
    currentMatch.set(0);
    const nextButton = await screen.findByRole('button', { name: 'Next match' });
    const prevButton = await screen.findByRole('button', { name: 'Previous match' });

    expect(currentMatch()).toBe(0);
    expect(nextButton).toBeEnabled();
    expect(prevButton).toBeDisabled();

    await user.click(nextButton);

    expect(currentMatch()).toBe(1);
    expect(prevButton).toBeEnabled();

    await user.click(nextButton);

    expect(currentMatch()).toBe(2);

    await user.click(nextButton);

    expect(currentMatch()).toBe(3);

    // Doesn't go beyond the last match.
    expect(nextButton).toBeDisabled();
  });

  it('should update current match on Previous click', async () => {
    const searchBox = screen.getByRole('textbox', { name: 'Search terms' });
    await user.type(searchBox, 'My query');

    expect(query()).toBe('My query');

    totalMatches.set(4);
    currentMatch.set(3);
    const nextButton = await screen.findByRole('button', { name: 'Next match' });
    const prevButton = await screen.findByRole('button', { name: 'Previous match' });

    expect(currentMatch()).toBe(3);
    expect(nextButton).toBeDisabled();
    expect(prevButton).toBeEnabled();

    await user.click(prevButton);

    expect(currentMatch()).toBe(2);
    expect(nextButton).toBeEnabled();

    await user.click(prevButton);

    expect(currentMatch()).toBe(1);

    await user.click(prevButton);

    expect(currentMatch()).toBe(0);

    // Doesn't go below 0.
    expect(prevButton).toBeDisabled();
  });

  it('should move to first item when Next is first clicked', async () => {
    const searchBox = screen.getByRole('textbox', { name: 'Search terms' });
    await user.type(searchBox, 'My query');

    expect(query()).toBe('My query');

    totalMatches.set(4);
    const nextButton = await screen.findByRole('button', { name: 'Next match' });
    const prevButton = await screen.findByRole('button', { name: 'Previous match' });

    expect(currentMatch()).toBeUndefined();
    expect(nextButton).toBeEnabled();
    expect(prevButton).toBeEnabled();

    await user.click(nextButton);

    expect(currentMatch()).toBe(0);
    expect(prevButton).toBeDisabled();
  });

  it('should move to last item when Previous is first clicked', async () => {
    const searchBox = screen.getByRole('textbox', { name: 'Search terms' });
    await user.type(searchBox, 'My query');

    expect(query()).toBe('My query');

    totalMatches.set(4);
    const nextButton = await screen.findByRole('button', { name: 'Next match' });
    const prevButton = await screen.findByRole('button', { name: 'Previous match' });

    expect(currentMatch()).toBeUndefined();
    expect(nextButton).toBeEnabled();
    expect(prevButton).toBeEnabled();

    await user.click(prevButton);

    expect(currentMatch()).toBe(3);
    expect(nextButton).toBeDisabled();
  });

  it('should update current match when Enter is pressed', async () => {
    const searchBox = screen.getByRole('textbox', { name: 'Search terms' });
    await user.type(searchBox, 'My query');

    expect(query()).toBe('My query');

    totalMatches.set(4);
    currentMatch.set(0);

    await user.type(searchBox, '[Enter]');

    expect(currentMatch()).toBe(1);

    await user.type(searchBox, '[Enter]');

    expect(currentMatch()).toBe(2);
  });

  it('should update current match when Shift + Enter is pressed', async () => {
    const searchBox = screen.getByRole('textbox', { name: 'Search terms' });
    await user.type(searchBox, 'My query');

    expect(query()).toBe('My query');

    totalMatches.set(4);
    currentMatch.set(3);

    await user.type(searchBox, '[ShiftLeft>][Enter][/ShiftLeft]');

    expect(currentMatch()).toBe(2);

    await user.type(searchBox, '[ShiftRight>][Enter][/ShiftRight]');

    expect(currentMatch()).toBe(1);
  });

  it('should keep current match when total matches changes but current match is still in range', async () => {
    const searchBox = screen.getByRole('textbox', { name: 'Search terms' });
    await user.type(searchBox, 'My query');

    expect(query()).toBe('My query');

    totalMatches.set(5);
    currentMatch.set(3);
    const nextButton = await screen.findByRole('button', { name: 'Next match' });
    const prevButton = await screen.findByRole('button', { name: 'Previous match' });

    await expect(screen.findByText('4 / 5')).resolves.toBeVisible();
    expect(currentMatch()).toBe(3);
    expect(nextButton).toBeEnabled();
    expect(prevButton).toBeEnabled();

    totalMatches.set(4);

    await expect(screen.findByText('4 / 4')).resolves.toBeVisible();
    expect(currentMatch()).toBe(3);
    expect(nextButton).toBeDisabled();
    expect(prevButton).toBeEnabled();
  });

  it('should reset current match when total matches changes and current match is out of range', async () => {
    const searchBox = screen.getByRole('textbox', { name: 'Search terms' });
    await user.type(searchBox, 'My query');

    expect(query()).toBe('My query');

    totalMatches.set(5);
    currentMatch.set(3);
    const nextButton = await screen.findByRole('button', { name: 'Next match' });
    const prevButton = await screen.findByRole('button', { name: 'Previous match' });

    await expect(screen.findByText('4 / 5')).resolves.toBeVisible();
    expect(currentMatch()).toBe(3);
    expect(nextButton).toBeEnabled();
    expect(prevButton).toBeEnabled();

    totalMatches.set(2);

    await expect(screen.findByText('2 / 2')).resolves.toBeVisible();
    expect(currentMatch()).toBe(1);
    expect(nextButton).toBeDisabled();
    expect(prevButton).toBeEnabled();
  });

  it('should reset current match when total matches changes to 0', async () => {
    const searchBox = screen.getByRole('textbox', { name: 'Search terms' });
    await user.type(searchBox, 'My query');

    expect(query()).toBe('My query');

    totalMatches.set(5);
    currentMatch.set(3);
    const nextButton = await screen.findByRole('button', { name: 'Next match' });
    const prevButton = await screen.findByRole('button', { name: 'Previous match' });

    await expect(screen.findByText('4 / 5')).resolves.toBeVisible();
    expect(currentMatch()).toBe(3);
    expect(nextButton).toBeEnabled();
    expect(prevButton).toBeEnabled();

    totalMatches.set(0);

    await expect(screen.findByText('0 / 0')).resolves.toBeVisible();
    expect(currentMatch()).toBeUndefined();
    expect(nextButton).toBeDisabled();
    expect(prevButton).toBeDisabled();
  });

  it('should keep current match in range on external model updates', async () => {
    const searchBox = screen.getByRole('textbox', { name: 'Search terms' });
    await user.type(searchBox, 'My query');

    expect(query()).toBe('My query');

    totalMatches.set(3);
    currentMatch.set(1);

    await expect(screen.findByText('2 / 3')).resolves.toBeVisible();
    expect(currentMatch()).toBe(1);

    currentMatch.set(5);

    await expect(screen.findByText('3 / 3')).resolves.toBeVisible();
    expect(currentMatch()).toBe(2);

    currentMatch.set(-1);

    await expect(screen.findByText('1 / 3')).resolves.toBeVisible();
    expect(currentMatch()).toBe(0);
  });

  it('should keep current match in range on external call to next()', async () => {
    const searchBox = screen.getByRole('textbox', { name: 'Search terms' });
    await user.type(searchBox, 'My query');

    expect(query()).toBe('My query');

    totalMatches.set(3);
    currentMatch.set(2);

    await expect(screen.findByText('3 / 3')).resolves.toBeVisible();
    expect(currentMatch()).toBe(2);

    rendered.fixture.componentInstance.next();

    await expect(screen.findByText('3 / 3')).resolves.toBeVisible();
    expect(currentMatch()).toBe(2);
  });

  it('should keep current match in range on external call to prev()', async () => {
    const searchBox = screen.getByRole('textbox', { name: 'Search terms' });
    await user.type(searchBox, 'My query');

    expect(query()).toBe('My query');

    totalMatches.set(3);
    currentMatch.set(0);

    await expect(screen.findByText('1 / 3')).resolves.toBeVisible();
    expect(currentMatch()).toBe(0);

    rendered.fixture.componentInstance.prev();

    await expect(screen.findByText('1 / 3')).resolves.toBeVisible();
    expect(currentMatch()).toBe(0);
  });

  it('should keep current match undefined when there are no results', async () => {
    const searchBox = screen.getByRole('textbox', { name: 'Search terms' });
    await user.type(searchBox, 'My query');

    expect(query()).toBe('My query');

    totalMatches.set(0);
    currentMatch.set(1);
    rendered.detectChanges();
    await rendered.fixture.whenStable();

    expect(currentMatch()).toBeUndefined();

    rendered.fixture.componentInstance.next();
    rendered.detectChanges();
    await rendered.fixture.whenStable();

    expect(currentMatch()).toBeUndefined();

    rendered.fixture.componentInstance.prev();
    rendered.detectChanges();
    await rendered.fixture.whenStable();

    expect(currentMatch()).toBeUndefined();
  });

  it('should focus the search box when the component is created', async () => {
    const searchBox = screen.getByRole('textbox', { name: 'Search terms' });

    expect(searchBox).not.toHaveFocus();

    rendered.fixture.componentInstance.focus();
    rendered.detectChanges();
    await rendered.fixture.whenStable();

    expect(searchBox).toHaveFocus();
  });
});
