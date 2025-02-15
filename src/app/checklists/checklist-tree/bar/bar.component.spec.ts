import { render, RenderResult, screen } from '@testing-library/angular';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { ChecklistTreeComponent } from '../checklist-tree.component';
import { ChecklistTreeBarComponent } from './bar.component';

describe('ChecklistTreeBarComponent', () => {
  let tree: jasmine.SpyObj<ChecklistTreeComponent>;
  let rendered: RenderResult<ChecklistTreeBarComponent>;
  let expandButton: HTMLElement;
  let collapseButton: HTMLElement;
  let user: UserEvent;

  beforeEach(async () => {
    user = userEvent.setup();

    tree = jasmine.createSpyObj<ChecklistTreeComponent>('ChecklistTreeComponent', [
      'isAllExpanded',
      'expandAll',
      'isAllCollapsed',
      'collapseAll',
    ]);

    rendered = await render(ChecklistTreeBarComponent, { inputs: { tree: tree } });
    expandButton = screen.queryByRole('button', { name: 'Expand all checklist groups' })!;
    collapseButton = screen.queryByRole('button', { name: 'Collapse all checklist groups' })!;
  });

  it('should render', () => {
    expect(screen.getByText('Checklist groups:')).toBeInTheDocument();
  });

  it('should disable expand button when all expanded', () => {
    tree.isAllExpanded.and.returnValue(true);
    tree.isAllCollapsed.and.returnValue(false);
    rendered.detectChanges();
    expect(expandButton).toBeDisabled();
    expect(collapseButton).toBeEnabled();
  });

  it('should disable collapse button when all collapsed', () => {
    tree.isAllExpanded.and.returnValue(false);
    tree.isAllCollapsed.and.returnValue(true);
    rendered.detectChanges();
    expect(expandButton).toBeEnabled();
    expect(collapseButton).toBeDisabled();
  });

  it('should expand all when that button is clicked', async () => {
    tree.isAllExpanded.and.returnValue(false);
    rendered.detectChanges();

    await user.click(expandButton);

    expect(tree.expandAll).toHaveBeenCalledOnceWith();
  });

  it('should collapse all when that button is clicked', async () => {
    tree.isAllCollapsed.and.returnValue(false);
    rendered.detectChanges();

    await user.click(collapseButton);

    expect(tree.collapseAll).toHaveBeenCalledOnceWith();
  });
});
