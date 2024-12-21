import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed, inject } from '@angular/core/testing';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { GoogleDriveDisconnectDialogComponent } from './gdrive-disconnect-dialog.component';

describe('GoogleDriveDisconnectDialogComponent', () => {
  let fixture: ComponentFixture<GoogleDriveDisconnectDialogComponent>;
  let loader: HarnessLoader;
  let dialog: MatDialog;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GoogleDriveDisconnectDialogComponent, MatDialogModule, NoopAnimationsModule],
      providers: [{ provide: MatDialogRef, useValue: {} }],
    }).compileComponents();

    fixture = TestBed.createComponent(GoogleDriveDisconnectDialogComponent);
    fixture.detectChanges();
    loader = TestbedHarnessEnvironment.documentRootLoader(fixture);
  });

  beforeEach(inject([MatDialog], (d: MatDialog) => {
    dialog = d;
  }));

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should open and cancel the dialog', async () => {
    const confirmPromise = GoogleDriveDisconnectDialogComponent.confirmDisconnection(dialog);

    let dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs.length).toBe(1);

    const cancelButton = await screen.findByRole('button', { name: 'Cancel' });
    await userEvent.click(cancelButton);

    dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs.length).toBe(0);

    expect(await confirmPromise).toBeUndefined();
  });

  it('should open and confirm the dialog', async () => {
    const confirmPromise = GoogleDriveDisconnectDialogComponent.confirmDisconnection(dialog);

    let dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs.length).toBe(1);

    const deleteAll = await screen.findByRole('checkbox', { name: 'Delete all EFIS Editor data from Google Drive' });
    expect(deleteAll).not.toBeChecked();

    const stopButton = await screen.findByRole('button', { name: 'Stop synchronization' });
    await userEvent.click(stopButton);

    dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs.length).toBe(0);

    expect(await confirmPromise).toEqual({ deleteAllData: false });
  });

  it('should open and confirm the dialog with data deletion', async () => {
    const confirmPromise = GoogleDriveDisconnectDialogComponent.confirmDisconnection(dialog);

    let dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs.length).toBe(1);

    const deleteAll = await screen.findByRole('checkbox', { name: 'Delete all EFIS Editor data from Google Drive' });
    expect(deleteAll).not.toBeChecked();
    await userEvent.click(deleteAll);
    expect(deleteAll).toBeChecked();

    const stopButton = await screen.findByRole('button', { name: 'Stop synchronization' });
    await userEvent.click(stopButton);

    dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs.length).toBe(0);

    expect(await confirmPromise).toEqual({ deleteAllData: true });
  });
});
