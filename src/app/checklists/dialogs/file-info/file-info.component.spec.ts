import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';

import { HarnessLoader } from '@angular/cdk/testing';
import { Component, input, output } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { render, screen } from '@testing-library/angular';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { ChecklistFileMetadata, ChecklistGroup } from '../../../../../gen/ts/checklist';
import { EXPECTED_CONTENTS } from '../../../../model/formats/test-data';
import { ChecklistFileInfoComponent } from './file-info.component';

@Component({
  standalone: true,
  imports: [MatDialogModule],
  selector: 'test-info-dialog',
  template: '<button (click)="openDialog()">Open dialog</button>',
})
export class DialogTestComponent {
  public readonly metadataIn = input.required<ChecklistFileMetadata>();
  public readonly groupsIn = input.required<ChecklistGroup[]>();
  public readonly dataOut = output<ChecklistFileMetadata | undefined>();

  constructor(private readonly _dialog: MatDialog) {}

  async openDialog() {
    return ChecklistFileInfoComponent.showFileInfo(this.metadataIn(), this.groupsIn(), this._dialog).then((value) => {
      this.dataOut.emit(value);
      return void 0;
    });
  }
}

describe('ChecklistFileInfoComponent', () => {
  let user: UserEvent;
  let loader: HarnessLoader;
  let metadata: ChecklistFileMetadata;
  let groups: ChecklistGroup[];
  let dataOut: jasmine.Spy;
  let okButton: HTMLButtonElement;
  let cancelButton: HTMLButtonElement;
  let nameBox: HTMLInputElement;
  let aircraftMakeModelBox: HTMLInputElement;
  let aircraftInfoBox: HTMLInputElement;
  let manufacturerBox: HTMLInputElement;
  let copyrightBox: HTMLInputElement;
  let defaultChecklistBox: HTMLSelectElement;

  beforeEach(() => {
    user = userEvent.setup();
    dataOut = jasmine.createSpy('dataOut');

    metadata = ChecklistFileMetadata.create({
      name: 'Name',
    });
    groups = [];
  });

  async function openDialog() {
    const rendered = await render(DialogTestComponent, {
      inputs: { metadataIn: metadata, groupsIn: groups },
      on: { dataOut },
    });

    const openDialogButton = await screen.findByRole('button', { name: /open dialog/i });
    await user.click(openDialogButton);

    loader = TestbedHarnessEnvironment.documentRootLoader(rendered.fixture);
    const dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs.length).toBe(1);

    okButton = await screen.findByRole('button', { name: 'Ok' });
    cancelButton = await screen.findByRole('button', { name: 'Cancel' });
    nameBox = await screen.findByRole('textbox', { name: 'File name' });
    aircraftMakeModelBox = await screen.findByRole('textbox', { name: 'Aircraft make and model' });
    aircraftInfoBox = await screen.findByRole('textbox', { name: 'Aircraft information' });
    manufacturerBox = await screen.findByRole('textbox', { name: 'Manufacturer information' });
    copyrightBox = await screen.findByRole('textbox', { name: 'Copyright information' });
    defaultChecklistBox = await screen.findByRole('combobox', { name: /Default checklist.*/ });

    return rendered;
  }

  it('should open and cancel the dialog', async () => {
    await openDialog();

    // Change some data to make sure the passed-in data doesn't get modified.
    await user.type(nameBox, 'abcdef');

    await user.click(cancelButton);

    const dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs.length).toBe(0);

    expect(dataOut).toHaveBeenCalledOnceWith(undefined);
    expect(metadata.name).toEqual('Name');
  });

  it('should change text fields', async () => {
    // Make sure these are preserved.
    metadata.defaultChecklistIndex = EXPECTED_CONTENTS.metadata!.defaultChecklistIndex;
    metadata.defaultGroupIndex = EXPECTED_CONTENTS.metadata!.defaultGroupIndex;

    await openDialog();

    const newMetadata = EXPECTED_CONTENTS.metadata!;
    await user.clear(nameBox);
    await user.type(nameBox, newMetadata.name);
    await user.type(aircraftMakeModelBox, newMetadata.makeAndModel);
    await user.type(aircraftInfoBox, newMetadata.aircraftInfo);
    await user.type(manufacturerBox, newMetadata.manufacturerInfo);
    await user.type(copyrightBox, newMetadata.copyrightInfo);
    await user.click(okButton);

    const dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs.length).toBe(0);

    // Original object must be unmodified, but new one must have been returned.
    expect(metadata.name).toEqual('Name');
    expect(dataOut).toHaveBeenCalledOnceWith(newMetadata);
  });

  it('should require name to be non-empty', async () => {
    groups = EXPECTED_CONTENTS.groups;
    metadata = EXPECTED_CONTENTS.metadata!;

    await openDialog();

    await user.clear(nameBox);
    expect(okButton).toBeDisabled();
  });

  it('should change default checklist', async () => {
    groups = EXPECTED_CONTENTS.groups;
    metadata = EXPECTED_CONTENTS.metadata!;

    await openDialog();

    expect(defaultChecklistBox.textContent).toContain('Test group 2 checklist 3 (default)');

    await user.click(defaultChecklistBox);
    const option = await screen.findByRole('option', { name: 'Test group 1 checklist 1' });
    await user.click(option);
    await user.click(okButton);

    // Original object must be unmodified, but new one must have been returned.
    expect(metadata.defaultGroupIndex).toEqual(1);
    expect(metadata.defaultChecklistIndex).toEqual(2);

    const expectedMetadata = ChecklistFileMetadata.clone(metadata);
    expectedMetadata.defaultChecklistIndex = 0;
    expectedMetadata.defaultGroupIndex = 0;
    expect(dataOut).toHaveBeenCalledOnceWith(expectedMetadata);
  });
});
