import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { Component, output } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { render, screen } from '@testing-library/angular';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { DEFAULT_OPTIONS, PdfWriterOptions } from '../../../../model/formats/pdf-writer';
import { PrintDialogComponent } from './print-dialog.component';

@Component({
  standalone: true,
  imports: [MatDialogModule],
  selector: 'test-print-dialog',
  template: '<button (click)="openDialog()">Open dialog</button>',
})
export class DialogTestComponent {
  public readonly dataOut = output<PdfWriterOptions | undefined>();

  constructor(private readonly _dialog: MatDialog) {}

  async openDialog() {
    return PrintDialogComponent.show(this._dialog).then((value) => {
      this.dataOut.emit(value);
      return void 0;
    });
  }
}

describe('PrintDialogComponent', () => {
  let user: UserEvent;
  let loader: HarnessLoader;
  let dataOut: jasmine.Spy;
  let okButton: HTMLButtonElement;
  let cancelButton: HTMLButtonElement;

  let paperSize: HTMLElement;
  let landscape: HTMLElement;
  let pageNumbers: HTMLElement;

  beforeEach(() => {
    user = userEvent.setup();
    dataOut = jasmine.createSpy('dataOut');
  });

  async function openDialog() {
    const rendered = await render(DialogTestComponent, {
      on: { dataOut },
    });

    const openDialogButton = await screen.findByRole('button', { name: /open dialog/i });
    await user.click(openDialogButton);

    loader = TestbedHarnessEnvironment.documentRootLoader(rendered.fixture);
    const dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs.length).toBe(1);

    okButton = await screen.findByRole('button', { name: 'Ok' });
    cancelButton = await screen.findByRole('button', { name: 'Cancel' });
    paperSize = await screen.findByRole('combobox', { name: /.*paper size.*/ });
    landscape = await screen.findByRole('radio', { name: 'Landscape' });
    pageNumbers = await screen.findByRole('checkbox', { name: 'Output page numbers' });

    return rendered;
  }

  it('should open and cancel the dialog', async () => {
    await openDialog();

    await user.click(cancelButton);

    const dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs.length).toBe(0);

    expect(dataOut).toHaveBeenCalledOnceWith(undefined);
  });

  it('should accept defaults ', async () => {
    await openDialog();

    await user.click(okButton);

    const dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs.length).toBe(0);

    // Original object must be unmodified, but new one must have been returned.
    expect(dataOut).toHaveBeenCalledOnceWith(DEFAULT_OPTIONS);
  });

  it('should emit changed options', async () => {
    await openDialog();

    await user.click(paperSize);
    const a1 = await screen.findByRole('option', { name: 'A1' });
    await user.click(a1);
    await user.click(landscape);
    await user.click(pageNumbers);

    await user.click(okButton);

    expect(dataOut).toHaveBeenCalledOnceWith({
      format: 'a1',
      orientation: 'landscape',
      outputCoverPage: true,
      outputCoverPageFooter: false,
      outputPageNumbers: false,
    });
  });
});
