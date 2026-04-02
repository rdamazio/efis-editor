import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { Component, output } from '@angular/core';
import { ComponentFixture, inject } from '@angular/core/testing';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { render, screen } from '@testing-library/angular';
import userEvent, { UserEvent } from '@testing-library/user-event';
import type { Mock } from 'vitest';
import { DEFAULT_OPTIONS, PdfWriterOptions } from '../../../../model/formats/pdf-writer';
import { LazyBrowserStorage } from '../../../../model/storage/browser-storage';
import { PreferenceStorage } from '../../../../model/storage/preference-storage';
import { PrintDialogComponent } from './print-dialog.component';

type OutputType = PdfWriterOptions | undefined;

@Component({
  selector: 'test-print-dialog',
  imports: [MatDialogModule],
  standalone: true,
  template: '<button (click)="openDialog()">Open dialog</button>',
})
class DialogTestComponent {
  public readonly dataOut = output<OutputType>();

  constructor(
    private readonly _dialog: MatDialog,
    private readonly _prefs: PreferenceStorage,
  ) {}

  async openDialog() {
    return PrintDialogComponent.show(this._dialog, this._prefs).then((value) => {
      this.dataOut.emit(value);
      return void 0;
    });
  }
}

describe('PrintDialogComponent', () => {
  let user: UserEvent;
  let loader: HarnessLoader;
  let prefs: PreferenceStorage;
  let fixture: ComponentFixture<DialogTestComponent>;
  let dataOut: Mock<(value: OutputType) => void>;
  let okButton: HTMLButtonElement;
  let cancelButton: HTMLButtonElement;
  let fontSize: HTMLInputElement;

  let paperSize: HTMLElement;
  let landscape: HTMLElement;
  let pageNumbers: HTMLElement;
  let completionActions: HTMLElement;

  beforeEach(async () => {
    user = userEvent.setup({ delay: null });
    dataOut = vi.fn();
    dataOut.mockName('PrintDialogComponent.dataOut');

    fixture = (await render(DialogTestComponent, { on: { dataOut: dataOut } })).fixture;
  });

  beforeEach(inject(
    [LazyBrowserStorage, PreferenceStorage],
    async (browserStore: LazyBrowserStorage, prefsStore: PreferenceStorage) => {
      browserStore.forceBrowserStorage();
      (await browserStore.storage).clear();
      prefs = prefsStore;
    },
  ));

  async function openDialog() {
    const openDialogButton = await screen.findByRole('button', { name: /open dialog/i });
    await user.click(openDialogButton);

    loader = TestbedHarnessEnvironment.documentRootLoader(fixture);
    const dialogs = await loader.getAllHarnesses(MatDialogHarness);

    expect(dialogs).toHaveLength(1);

    okButton = await screen.findByRole('button', { name: 'Ok' });
    cancelButton = await screen.findByRole('button', { name: 'Cancel' });
    paperSize = await screen.findByRole('combobox', { name: /.*paper size.*/ });
    landscape = await screen.findByRole('radio', { name: 'Landscape' });
    pageNumbers = await screen.findByRole('checkbox', { name: 'Output page numbers' });
    completionActions = await screen.findByRole('checkbox', { name: 'Output completion actions' });
    fontSize = await screen.findByRole('spinbutton', { name: 'Font size (%)' });
  }

  it('should open and cancel the dialog', async () => {
    await openDialog();

    await user.click(cancelButton);

    const dialogs = await loader.getAllHarnesses(MatDialogHarness);

    expect(dialogs).toHaveLength(0);

    expect(dataOut).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  it('should open, modify and cancel the dialog, without changing stored settings', async () => {
    await prefs.setPrintOptions({
      pageSize: 'a6',
    });

    await openDialog();

    await user.click(paperSize);
    const a1 = await screen.findByRole('option', { name: 'A1' });
    await user.click(a1);

    await user.click(cancelButton);

    const dialogs = await loader.getAllHarnesses(MatDialogHarness);

    expect(dialogs).toHaveLength(0);

    expect(dataOut).toHaveBeenCalledExactlyOnceWith(undefined);

    const newOpts = await prefs.getPrintOptions();

    expect(newOpts.pageSize).toEqual('a6');
  });

  it('should accept defaults', async () => {
    await openDialog();

    await user.click(okButton);

    const dialogs = await loader.getAllHarnesses(MatDialogHarness);

    expect(dialogs).toHaveLength(0);

    // Original object must be unmodified, but new one must have been returned.
    expect(dataOut).toHaveBeenCalledExactlyOnceWith(DEFAULT_OPTIONS);
  });

  it('should emit and store changed options', async () => {
    await openDialog();

    await user.click(paperSize);
    const a1 = await screen.findByRole('option', { name: 'A1' });
    await user.click(a1);
    await user.click(landscape);
    await user.click(pageNumbers);
    await user.click(completionActions);

    const checklistStartPage = await screen.findByRole('radio', { name: 'New page' });
    await user.click(checklistStartPage);

    await user.clear(fontSize);
    await user.type(fontSize, '90');

    await user.click(okButton);

    const expectedOpts: PdfWriterOptions = {
      ...DEFAULT_OPTIONS,
      pageSize: 'a1',
      orientation: 'landscape',
      outputCoverPage: true,
      outputPageNumbers: false,
      outputCompletionActions: false,
      checklistStart: 'page',
      fontSizePercent: 90,
    };

    expect(dataOut).toHaveBeenCalledExactlyOnceWith(expectedOpts);

    const newOpts = await prefs.getPrintOptions();

    expect(newOpts).toEqual(expectedOpts);
  });

  it('should use stored options as new default', async () => {
    const expectedOpts: PdfWriterOptions = {
      ...DEFAULT_OPTIONS,
      pageSize: 'a6',
      orientation: 'landscape',
      checklistStart: 'page',
      fontSizePercent: 150,
    };
    await prefs.setPrintOptions(expectedOpts);

    await openDialog();

    await user.click(okButton);

    const dialogs = await loader.getAllHarnesses(MatDialogHarness);

    expect(dialogs).toHaveLength(0);

    expect(dataOut).toHaveBeenCalledWith({
      ...expectedOpts,
      checklistStart: 'page', // Clamped due to columns=1 overriding 'below' which was copied from DEFAULT_OPTIONS
    });

    const newOpts = await prefs.getPrintOptions();

    expect(newOpts).toEqual({
      ...expectedOpts,
      checklistStart: 'page',
    });
  });

  it('should automatically select "New page" when columns is set to 1 and "New column" is selected', async () => {
    // Start with a state where columns > 1 and checklistStart is not 'page'
    await prefs.setPrintOptions({
      columns: 2,
      checklistStart: 'column',
    });

    await openDialog();

    // Verify initial state is reflected in the UI
    const columnsInput = await screen.findByRole('spinbutton', { name: 'Columns' });

    expect(columnsInput).toHaveValue(2);

    // The "New column" radio should be checked initially
    const checklistStartColumn = await screen.findByRole('radio', { name: 'New column' });

    expect(checklistStartColumn).toBeChecked();

    // Change columns to 1
    await user.clear(columnsInput);
    await user.type(columnsInput, '1');

    // The "New page" radio should now be automatically selected
    const checklistStartPage = await screen.findByRole('radio', { name: 'New page' });

    expect(checklistStartPage).toBeChecked();
    expect(checklistStartColumn).toBeDisabled();

    // The logic should also correctly emit the clamped value
    await user.click(okButton);

    expect(dataOut).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        columns: 1,
        checklistStart: 'page',
      }),
    );
  });
});
