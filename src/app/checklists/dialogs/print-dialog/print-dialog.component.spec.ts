import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { Component, output } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { render, screen } from '@testing-library/angular';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { DEFAULT_OPTIONS, PdfWriterOptions } from '../../../../model/formats/pdf-writer';
import { PrintDialogComponent } from './print-dialog.component';
import { PreferenceStorage } from '../../../../model/storage/preference-storage';
import { LazyBrowserStorage } from '../../../../model/storage/browser-storage';
import { ComponentFixture, inject } from '@angular/core/testing';

@Component({
  standalone: true,
  imports: [MatDialogModule],
  selector: 'test-print-dialog',
  template: '<button (click)="openDialog()">Open dialog</button>',
})
export class DialogTestComponent {
  public readonly dataOut = output<PdfWriterOptions | undefined>();

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
  let dataOut: jasmine.Spy;
  let okButton: HTMLButtonElement;
  let cancelButton: HTMLButtonElement;

  let paperSize: HTMLElement;
  let landscape: HTMLElement;
  let pageNumbers: HTMLElement;

  beforeEach(async () => {
    user = userEvent.setup();
    dataOut = jasmine.createSpy('dataOut');

    fixture = (await render(DialogTestComponent, { on: { dataOut } })).fixture;
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
    expect(dialogs.length).toBe(1);

    okButton = await screen.findByRole('button', { name: 'Ok' });
    cancelButton = await screen.findByRole('button', { name: 'Cancel' });
    paperSize = await screen.findByRole('combobox', { name: /.*paper size.*/ });
    landscape = await screen.findByRole('radio', { name: 'Landscape' });
    pageNumbers = await screen.findByRole('checkbox', { name: 'Output page numbers' });
  }

  it('should open and cancel the dialog', async () => {
    await openDialog();

    await user.click(cancelButton);

    const dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs.length).toBe(0);

    expect(dataOut).toHaveBeenCalledOnceWith(undefined);
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
    expect(dialogs.length).toBe(0);

    expect(dataOut).toHaveBeenCalledOnceWith(undefined);

    const newOpts = await prefs.getPrintOptions();
    expect(newOpts).not.toBeNull();
    expect(newOpts.pageSize).toEqual('a6');
  });

  it('should accept defaults ', async () => {
    await openDialog();

    await user.click(okButton);

    const dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs.length).toBe(0);

    // Original object must be unmodified, but new one must have been returned.
    expect(dataOut).toHaveBeenCalledOnceWith(DEFAULT_OPTIONS);
  });

  it('should emit and store changed options', async () => {
    await openDialog();

    await user.click(paperSize);
    const a1 = await screen.findByRole('option', { name: 'A1' });
    await user.click(a1);
    await user.click(landscape);
    await user.click(pageNumbers);

    await user.click(okButton);

    const expectedOpts: PdfWriterOptions = {
      ...DEFAULT_OPTIONS,
      pageSize: 'a1',
      orientation: 'landscape',
      outputCoverPage: true,
      outputPageNumbers: false,
    };
    expect(dataOut).toHaveBeenCalledOnceWith(expectedOpts);
    const newOpts = await prefs.getPrintOptions();
    expect(newOpts).toEqual(expectedOpts);
  });

  it('should use stored options as new default', async () => {
    const expectedOpts: PdfWriterOptions = {
      ...DEFAULT_OPTIONS,
      pageSize: 'a6',
      orientation: 'landscape',
    };
    await prefs.setPrintOptions(expectedOpts);

    await openDialog();

    await user.click(okButton);

    const dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs.length).toBe(0);

    expect(dataOut).toHaveBeenCalledOnceWith(expectedOpts);
    const newOpts = await prefs.getPrintOptions();
    expect(newOpts).toEqual(expectedOpts);
  });
});
