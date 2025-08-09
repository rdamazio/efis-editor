import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { render, RenderResult, screen } from '@testing-library/angular';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { ChecklistGroup_Category } from '../../../../../gen/ts/checklist';
import { ChecklistTreeNode } from './node';
import { ChecklistTreeNodeComponent } from './node.component';

describe('NodeComponent', () => {
  let user: UserEvent;
  let node: ChecklistTreeNode;
  let disableButtonHover: boolean;
  let nodeRename: jasmine.Spy;
  let nodeDelete: jasmine.Spy;

  beforeEach(() => {
    user = userEvent.setup();

    node = { isAddNew: false, title: 'Node title' };
    disableButtonHover = false;
    nodeRename = jasmine.createSpy('nodeRename');
    nodeDelete = jasmine.createSpy('nodeDelete');
  });

  async function renderComponent(): Promise<RenderResult<ChecklistTreeNodeComponent>> {
    return render(ChecklistTreeNodeComponent, {
      imports: [NoopAnimationsModule],
      inputs: { node: node, disableButtonHover: disableButtonHover },
      on: { nodeRename, nodeDelete },
    });
  }

  it('should render', async () => {
    await renderComponent();

    expect(screen.getByText(node.title)).toBeInTheDocument();
    expect(screen.getByText('drag_handle')).toBeInTheDocument();
  });

  it('should render buttons on hover', async () => {
    await renderComponent();

    const renameButton = screen.queryByTestId('rename-button');
    expect(renameButton).not.toBeVisible();

    const title = screen.queryByText(node.title);
    expect(title).toBeInTheDocument();
    await user.hover(title!);

    expect(await screen.findByTestId('rename-button')).toBeVisible();
    expect(await screen.findByTestId('delete-button')).toBeVisible();
  });

  it('should not render buttons on hover if disabled', async () => {
    disableButtonHover = true;
    await renderComponent();

    const title = screen.queryByText(node.title);
    expect(title).toBeInTheDocument();
    await user.hover(title!);

    expect(await screen.findByTestId('rename-button')).not.toBeVisible();
    expect(await screen.findByTestId('delete-button')).not.toBeVisible();
  });

  it('should render Add new node', async () => {
    node.isAddNew = true;
    await renderComponent();

    expect(screen.getByRole('button', { name: node.title })).toBeInTheDocument();
    expect(screen.queryByText('Rename ' + node.title)).not.toBeInTheDocument();
    expect(screen.queryByText('Delete ' + node.title)).not.toBeInTheDocument();
    expect(screen.queryByText('drag_handle')).not.toBeInTheDocument();
  });

  it('should output when rename is clicked', async () => {
    await renderComponent();

    const renameButton = await screen.findByTestId('rename-button');
    expect(renameButton).toBeInTheDocument();
    await user.click(renameButton);

    expect(nodeRename).toHaveBeenCalledOnceWith(node);
  });

  it('should output when delete is clicked and user confirms', async () => {
    await renderComponent();

    const deleteButton = await screen.findByTestId('delete-button');
    expect(deleteButton).toBeInTheDocument();
    await user.click(deleteButton);

    const confirmButton = await screen.findByRole('button', { name: 'Delete!' });
    expect(confirmButton).toBeInTheDocument();
    await user.click(confirmButton);

    expect(screen.queryByRole('button', { name: 'Delete!' })).not.toBeInTheDocument();
    expect(nodeDelete).toHaveBeenCalledOnceWith(node);
  });

  it('should not output when delete is clicked and user cancels', async () => {
    await renderComponent();

    const deleteButton = await screen.findByTestId('delete-button');
    expect(deleteButton).toBeInTheDocument();
    await user.click(deleteButton);

    const cancelButton = await screen.findByRole('button', { name: 'Cancel' });
    expect(cancelButton).toBeInTheDocument();
    await user.click(cancelButton);

    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(nodeDelete).not.toHaveBeenCalled();
  });

  it('should render and change categories for group nodes', async () => {
    node.group = { title: 'Group name', checklists: [], category: ChecklistGroup_Category.abnormal };
    await renderComponent();

    // Current category should show.
    const categoryIcon = await screen.findByText(/🄰.*/);
    expect(categoryIcon).toBeVisible();

    // Change to normal category.
    await user.click(categoryIcon);
    const normalOption = await screen.findByText('🄽ormal');
    expect(normalOption).toBeVisible();
    await user.click(normalOption);

    expect(screen.queryByText(/🄰.*/)).not.toBeInTheDocument();

    // Verify that model was changed.
    expect(node.group.category).toEqual(ChecklistGroup_Category.normal);
  });
});
