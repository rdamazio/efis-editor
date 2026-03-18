import { render, RenderResult, screen } from '@testing-library/angular';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { mock, MockProxy } from 'vitest-mock-extended';
import { ChecklistTreeComponent } from '../checklist-tree.component';
import { ChecklistTreeBarComponent } from './bar.component';

describe('ChecklistTreeBarComponent', () => {
  let tree: MockProxy<ChecklistTreeComponent>;
  let rendered: RenderResult<ChecklistTreeBarComponent>;
  let expandButton: HTMLElement;
  let collapseButton: HTMLElement;
  let user: UserEvent;

  beforeEach(async () => {
    user = userEvent.setup();

    tree = mock<ChecklistTreeComponent>();

    rendered = await render(ChecklistTreeBarComponent, {
      inputs: { tree: tree },
    });
    expandButton = screen.queryByRole('button', { name: 'Expand all checklist groups' })!;
    collapseButton = screen.queryByRole('button', { name: 'Collapse all checklist groups' })!;
  });

  it('should render', () => {
    expect(screen.getByText('Checklist groups:')).toBeInTheDocument();
  });

  it('should disable expand button when all expanded', () => {
    tree.isAllExpanded.mockReturnValue(true);
    tree.isAllCollapsed.mockReturnValue(false);
    rendered.detectChanges();

    expect(expandButton).toBeDisabled();
    expect(collapseButton).toBeEnabled();
  });

  it('should disable collapse button when all collapsed', () => {
    tree.isAllExpanded.mockReturnValue(false);
    tree.isAllCollapsed.mockReturnValue(true);
    rendered.detectChanges();

    expect(expandButton).toBeEnabled();
    expect(collapseButton).toBeDisabled();
  });

  it('should expand all when that button is clicked', async () => {
    tree.isAllExpanded.mockReturnValue(false);
    rendered.detectChanges();

    await user.click(expandButton);

    expect(tree.expandAll).toHaveBeenCalledExactlyOnceWith();
  });

  it('should collapse all when that button is clicked', async () => {
    tree.isAllCollapsed.mockReturnValue(false);
    rendered.detectChanges();

    await user.click(collapseButton);

    expect(tree.collapseAll).toHaveBeenCalledExactlyOnceWith();
  });
});
