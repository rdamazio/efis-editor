import { fireEvent, render, RenderResult, screen } from '@testing-library/angular';
import { ChecklistGroup_Category } from '../../../../../gen/ts/checklist';
import { ChecklistTreeNode } from './node';
import { ChecklistTreeNodeComponent } from './node.component';

describe('NodeComponent', () => {
  let node: ChecklistTreeNode;
  let disableButtonHover: boolean;
  let nodeRename: jasmine.Spy;
  let nodeDelete: jasmine.Spy;

  beforeEach(() => {
    node = {
      isAddNew: false,
      title: 'Node title',
    };
    disableButtonHover = false;
    nodeRename = jasmine.createSpy('nodeRename');
    nodeDelete = jasmine.createSpy('nodeDelete');
  });

  async function renderComponent(): Promise<RenderResult<ChecklistTreeNodeComponent>> {
    return render(ChecklistTreeNodeComponent, {
      inputs: { node: node, disableButtonHover: disableButtonHover },
      on: { nodeRename, nodeDelete },
    });
  }

  it('should render', async () => {
    await renderComponent();

    expect(screen.queryByText(node.title)).toBeInTheDocument();
    expect(screen.queryByText('drag_handle')).toBeInTheDocument();
  });

  it('should render buttons on hover', async () => {
    await renderComponent();

    const renameButton = screen.queryByTestId('rename-button');
    expect(renameButton).not.toBeVisible();

    const title = screen.queryByText(node.title);
    expect(title).toBeInTheDocument();
    fireEvent.mouseOver(title!);

    expect(await screen.findByTestId('rename-button')).toBeVisible();
    expect(await screen.findByTestId('delete-button')).toBeVisible();
  });

  it('should not render buttons on hover if disabled', async () => {
    disableButtonHover = true;
    await renderComponent();

    const title = screen.queryByText(node.title);
    expect(title).toBeInTheDocument();
    fireEvent.mouseOver(title!);

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
    fireEvent.click(renameButton);

    expect(nodeRename).toHaveBeenCalledOnceWith(node);
  });

  it('should output when delete is clicked and user confirms', async () => {
    await renderComponent();

    const deleteButton = await screen.findByTestId('delete-button');
    expect(deleteButton).toBeInTheDocument();
    fireEvent.click(deleteButton);

    const confirmButton = await screen.findByRole('button', { name: 'Delete!' });
    expect(confirmButton).toBeInTheDocument();
    fireEvent.click(confirmButton);

    expect(await screen.findByRole('button', { name: 'Delete!' })).not.toBeInTheDocument();
    expect(nodeDelete).toHaveBeenCalledOnceWith(node);
  });

  it('should not output when delete is clicked and user cancels', async () => {
    await renderComponent();

    const deleteButton = await screen.findByTestId('delete-button');
    expect(deleteButton).toBeInTheDocument();
    fireEvent.click(deleteButton);

    const cancelButton = await screen.findByRole('button', { name: 'Cancel' });
    expect(cancelButton).toBeInTheDocument();
    fireEvent.click(cancelButton);

    expect(await screen.findByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(nodeDelete).not.toHaveBeenCalled();
  });

  it('should render and change categories for group nodes', async () => {
    node.group = {
      title: 'Group name',
      checklists: [],
      category: ChecklistGroup_Category.abnormal,
    };
    await renderComponent();

    // Current category should show.
    const categoryIcon = await screen.findByText(/🄰.*/);
    expect(categoryIcon).toBeVisible();

    // Change to normal category.
    fireEvent.click(categoryIcon);
    const normalOption = await screen.findByText('🄽ormal');
    expect(normalOption).toBeVisible();
    fireEvent.click(normalOption);

    expect(await screen.findByText(/🄰.*/)).not.toBeInTheDocument();

    // Verify that model was changed.
    expect(node.group.category).toEqual(ChecklistGroup_Category.normal);
  });
});
