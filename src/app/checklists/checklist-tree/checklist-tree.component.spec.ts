import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { render, RenderResult, screen, within } from '@testing-library/angular';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { Checklist, ChecklistFile } from '../../../../gen/ts/checklist';
import { EXPECTED_CONTENTS, EXPECTED_FOREFLIGHT_CONTENTS } from '../../../model/formats/test-data';
import { ChecklistTreeComponent } from './checklist-tree.component';

describe('ChecklistTreeComponent', () => {
  let user: UserEvent;
  let file: ChecklistFile;
  let selectedChecklistInput: Checklist | undefined;
  let fileModified: jasmine.Spy;
  let selectedChecklist: jasmine.Spy;
  let selectedChecklistGroup: jasmine.Spy;

  beforeEach(() => {
    user = userEvent.setup();
    file = ChecklistFile.clone(EXPECTED_CONTENTS);
    selectedChecklistInput = undefined;

    fileModified = jasmine.createSpy('fileModified');
    selectedChecklist = jasmine.createSpy('selectedChecklist');
    selectedChecklistGroup = jasmine.createSpy('selectedChecklistGroup');
  });

  async function renderComponent(): Promise<RenderResult<ChecklistTreeComponent>> {
    return render(ChecklistTreeComponent, {
      imports: [NoopAnimationsModule],
      inputs: { file: file, selectedChecklist: selectedChecklistInput },
      on: { fileModified, selectedChecklist, selectedChecklistGroup },
    });
  }

  it('should render', async () => {
    await renderComponent();

    for (const group of file.groups) {
      const groupEl = screen.getByRole('treeitem', { name: 'Group: ' + group.title });
      expect(groupEl).toBeVisible();
      for (const checklist of group.checklists) {
        expect(within(groupEl).getByRole('treeitem', { name: 'Checklist: ' + checklist.title })).toBeVisible();
      }
    }
  });

  it('should change files', async () => {
    const { fixture } = await renderComponent();

    expect(screen.getByRole('treeitem', { name: 'Checklist: Test group 1 checklist 1' })).toBeVisible();

    fixture.componentInstance.file.set(EXPECTED_FOREFLIGHT_CONTENTS);

    expect(await screen.findByRole('treeitem', { name: 'Group: Test empty abnormal subgroup' })).toBeVisible();
    expect(screen.queryByRole('treeitem', { name: 'Checklist: Test group 1 checklist 1' })).not.toBeInTheDocument();
  });

  it('should emit when a node is selected', async () => {
    await renderComponent();

    const checklist = await screen.findByRole('treeitem', { name: 'Checklist: Test group 2 checklist 2' });
    await user.click(checklist);

    expect(selectedChecklist).toHaveBeenCalledOnceWith(file.groups[1].checklists[1]);
    expect(selectedChecklistGroup).toHaveBeenCalledOnceWith(file.groups[1]);
  });

  it('should create a new checklist', async () => {
    await renderComponent();

    const group2 = await screen.findByRole('treeitem', { name: 'Group: Test group 2 (default)' });
    const addChecklist = await within(group2).findByRole('treeitem', { name: 'Add new checklist' });
    await user.click(addChecklist);

    const titleBox = await screen.findByRole('textbox', { name: 'Title' });
    await user.type(titleBox, 'My new checklist[Enter]');

    expect(await screen.findByRole('treeitem', { name: 'Checklist: My new checklist' })).toBeVisible();

    expect(fileModified).toHaveBeenCalledOnceWith(file);
    expect(file.groups[1].checklists).toHaveSize(4);
    expect(file.groups[1].checklists[3].title).toEqual('My new checklist');

    expect(selectedChecklist).toHaveBeenCalledOnceWith(file.groups[1].checklists[3]);
    expect(selectedChecklistGroup).toHaveBeenCalledOnceWith(file.groups[1]);
  });

  it('should create a new group', async () => {
    await renderComponent();

    // Select a checklist first to see that it gets deselected
    await user.click(screen.queryByRole('treeitem', { name: 'Checklist: Test group 1 checklist 1' })!);
    expect(selectedChecklist).toHaveBeenCalledWith(file.groups[0].checklists[0]);
    expect(selectedChecklistGroup).toHaveBeenCalledWith(file.groups[0]);

    const addGroup = await screen.findByRole('treeitem', { name: 'Add new checklist group' });
    await user.click(addGroup);

    const titleBox = await screen.findByRole('textbox', { name: 'Title' });
    await user.type(titleBox, 'My new group[Enter]');

    expect(await screen.findByRole('treeitem', { name: 'Group: My new group' })).toBeVisible();

    expect(fileModified).toHaveBeenCalledOnceWith(file);
    expect(file.groups).toHaveSize(3);
    expect(file.groups[2].title).toEqual('My new group');

    expect(selectedChecklist).toHaveBeenCalledWith(undefined);
    expect(selectedChecklistGroup).toHaveBeenCalledWith(file.groups[2]);
  });

  it('should rename a checklist', async () => {
    await renderComponent();

    const checklist = await screen.findByText('Test group 1 checklist 1');
    await user.hover(checklist);

    const renameButton = await screen.findByRole('button', { name: 'Rename Test group 1 checklist 1' });
    expect(renameButton).toBeVisible();
    await user.click(renameButton);

    const titleBox = await screen.findByRole('textbox', { name: 'Title' });
    await user.clear(titleBox);
    await user.type(titleBox, 'Renamed checklist[Enter]');

    expect(screen.queryByRole('treeitem', { name: 'Checklist: Test group 1 checklist 1' })).not.toBeInTheDocument();
    expect(screen.queryByRole('treeitem', { name: 'Checklist: Renamed checklist' })).toBeVisible();

    expect(file.groups[0].checklists[0].title).toEqual('Renamed checklist');
    expect(fileModified).toHaveBeenCalledOnceWith(file);
  });

  it('should rename a group', async () => {
    await renderComponent();

    const checklist = await screen.findByText('Test group 2 (default)');
    await user.hover(checklist);

    const renameButton = await screen.findByRole('button', { name: 'Rename Test group 2 (default)' });
    expect(renameButton).toBeVisible();
    await user.click(renameButton);

    const titleBox = await screen.findByRole('textbox', { name: 'Title' });
    await user.clear(titleBox);
    await user.type(titleBox, 'Renamed group[Enter]');

    expect(screen.queryByRole('treeitem', { name: 'Group: Test group 2 (default)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('treeitem', { name: 'Group: Renamed group' })).toBeVisible();

    expect(file.groups[1].title).toEqual('Renamed group');
    expect(fileModified).toHaveBeenCalledOnceWith(file);
  });

  it('should delete a checklist', async () => {
    await renderComponent();

    // Select the checklist to make sure it gets deselected.
    const checklist = await screen.findByRole('treeitem', { name: 'Checklist: Test group 2 checklist 2' });
    await user.click(checklist);
    expect(selectedChecklist).toHaveBeenCalledOnceWith(file.groups[1].checklists[1]);
    expect(selectedChecklistGroup).toHaveBeenCalledOnceWith(file.groups[1]);

    await user.hover(await screen.findByText('Test group 2 checklist 2'));

    const deleteButton = await within(checklist).findByRole('button', { name: 'Delete Test group 2 checklist 2' });
    expect(deleteButton).toBeVisible();
    await user.click(deleteButton);

    const confirmButton = await screen.findByRole('button', { name: 'Delete!' });
    await user.click(confirmButton);

    expect(screen.queryByRole('treeitem', { name: 'Checklist: Test group 2 checklist 2' })).not.toBeInTheDocument();

    expect(file.groups[1].checklists).toHaveSize(2);
    expect(file.groups[1].checklists[1].title).toEqual(EXPECTED_CONTENTS.groups[1].checklists[2].title);
    expect(fileModified).toHaveBeenCalledOnceWith(file);
    expect(selectedChecklist).toHaveBeenCalledWith(undefined);
  });

  it('should delete a Group', async () => {
    await renderComponent();

    // Select a checklist in the group to make sure it gets deselected.
    const checklist = await screen.findByText('Test group 2 checklist 2');
    await user.click(checklist);
    expect(selectedChecklist).toHaveBeenCalledOnceWith(file.groups[1].checklists[1]);
    expect(selectedChecklistGroup).toHaveBeenCalledOnceWith(file.groups[1]);

    const group = await screen.findByRole('treeitem', { name: 'Group: Test group 2 (default)' });
    // If we hover over the group itself, that may be on top of a leaf node and reveal the wrong
    // delete button.
    const groupName = await within(group).findByText('Test group 2 (default)');
    await user.hover(groupName);

    const deleteButton = await within(group).findByRole('button', { name: 'Delete Test group 2 (default)' });
    expect(deleteButton).toBeVisible();
    await user.click(deleteButton);

    const confirmButton = await screen.findByRole('button', { name: 'Delete!' });
    await user.click(confirmButton);

    expect(screen.queryByRole('treeitem', { name: 'Group: Test group 2 (default)' })).not.toBeInTheDocument();

    expect(file.groups).toHaveSize(1);
    expect(file.groups[0].checklists).toHaveSize(1);
    expect(fileModified).toHaveBeenCalledOnceWith(file);
    expect(selectedChecklist).toHaveBeenCalledWith(undefined);
    expect(selectedChecklistGroup).toHaveBeenCalledWith(undefined);
  });

  // TODO: Drag and drop checklist
  // TODO: Drag and drop checklist into another group
  // TODO: Drag and drop group

  // Helpful references for drag and drop testing:
  // https://github.com/angular/components/blob/main/src/cdk/drag-drop/directives/test-utils.spec.ts
  // https://github.com/angular/components/blob/main/src/cdk/testing/testbed/fake-events/dispatch-events.ts
  // https://github.com/angular/components/blob/main/src/cdk/testing/testbed/fake-events/event-objects.ts
  // https://github.com/DevCloudFE/ng-devui/blob/master/devui/transfer/transfer.spec.ts
  // https://github.com/DevCloudFE/ng-devui/blob/master/devui/utils/testing/event-helper.ts
});
