import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';

import { HarnessLoader } from '@angular/cdk/testing';
import { Component, input, output } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { render, screen } from '@testing-library/angular';
import userEvent, { UserEvent } from '@testing-library/user-event';
import {
  Checklist,
  Checklist_CompletionAction,
  ChecklistItem,
  ChecklistItem_Type,
} from '../../../../../gen/ts/checklist';
import { ChecklistInfoComponent } from './checklist-info';

type OutputType = Checklist | undefined;

@Component({
  selector: 'test-info-dialog',
  imports: [MatDialogModule],
  standalone: true,
  template: '<button (click)="openDialog()">Open dialog</button>',
})
export class DialogTestComponent {
  public readonly dataIn = input.required<Checklist>();
  public readonly dataOut = output<OutputType>();

  constructor(private readonly _dialog: MatDialog) {}

  async openDialog() {
    return ChecklistInfoComponent.showChecklistInfo(this.dataIn(), this._dialog).then((value) => {
      this.dataOut.emit(value);
      return void 0;
    });
  }
}

const DEFAULT_DATA_IN = Checklist.create({
  title: 'Checklist title',
  items: [
    ChecklistItem.create({
      type: ChecklistItem_Type.ITEM_WARNING,
      indent: 1,
      centered: false,
      prompt: 'This must be left untouched',
    }),
  ],
  completionAction: Checklist_CompletionAction.ACTION_OPEN_MAP,
});

describe('ChecklistInfoComponent', () => {
  let user: UserEvent;
  let loader: HarnessLoader;
  let dataIn: Checklist;
  let dataOut: jasmine.Spy<(value: OutputType) => void>;
  let okButton: HTMLButtonElement;
  let cancelButton: HTMLButtonElement;
  let titleBox: HTMLInputElement;
  let onCompletionBox: HTMLSelectElement;

  beforeEach(() => {
    user = userEvent.setup();
    dataOut = jasmine.createSpy('dataOut');

    dataIn = Checklist.clone(DEFAULT_DATA_IN);
  });

  async function openDialog() {
    const { fixture } = await render(DialogTestComponent, {
      inputs: { dataIn },
      on: { dataOut },
    });

    const openDialogButton = await screen.findByRole('button', { name: /open dialog/i });
    await user.click(openDialogButton);

    loader = TestbedHarnessEnvironment.documentRootLoader(fixture);
    const dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs.length).toBe(1);

    okButton = await screen.findByRole('button', { name: 'Ok' });
    cancelButton = await screen.findByRole('button', { name: 'Cancel' });
    titleBox = await screen.findByRole('textbox', { name: 'Title' });
    onCompletionBox = await screen.findByRole('combobox', { name: 'On completion' });
  }

  it('should open and cancel the dialog', async () => {
    await openDialog();

    // Change some data to make sure the passed-in data doesn't get modified.
    await user.type(titleBox, 'abcdef');

    await user.click(cancelButton);

    const dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs.length).toBe(0);

    expect(dataOut).toHaveBeenCalledOnceWith(undefined);
    expect(dataIn).toEqual(DEFAULT_DATA_IN);
  });

  it('should change title', async () => {
    await openDialog();

    await user.clear(titleBox);
    await user.type(titleBox, 'New title');
    await user.click(okButton);

    const dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs.length).toBe(0);

    const modifiedData = Checklist.clone(DEFAULT_DATA_IN);
    modifiedData.title = 'New title';

    expect(dataOut).toHaveBeenCalledOnceWith(modifiedData);
  });

  it('should require title to be non-empty', async () => {
    await openDialog();

    await user.clear(titleBox);
    expect(okButton).toBeDisabled();
    await user.click(cancelButton);
  });

  it('should change completion action', async () => {
    await openDialog();

    expect(onCompletionBox.textContent).toContain('Open map');

    await user.click(onCompletionBox);
    const option = await screen.findByRole('option', { name: 'Open flight plan' });
    await user.click(option);
    await user.click(okButton);

    const dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs.length).toBe(0);

    const modifiedData = Checklist.clone(DEFAULT_DATA_IN);
    modifiedData.completionAction = Checklist_CompletionAction.ACTION_OPEN_FLIGHT_PLAN;

    expect(dataOut).toHaveBeenCalledOnceWith(modifiedData);
  });
});
