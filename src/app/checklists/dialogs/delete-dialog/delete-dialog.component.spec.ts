import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, inject, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { DeleteDialogComponent, DeleteDialogData } from './delete-dialog.component';

const DATA: DeleteDialogData = { entityType: 'planet', entityDescription: 'planet and all its inhabitants' };

describe('DeleteDialogComponent', () => {
  let fixture: ComponentFixture<DeleteDialogComponent>;
  let loader: HarnessLoader;
  let dialog: MatDialog;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeleteDialogComponent, MatDialogModule, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: {} },
        { provide: MAT_DIALOG_DATA, useValue: DATA },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DeleteDialogComponent);
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
    const confirmPromise = DeleteDialogComponent.confirmDeletion(DATA, dialog);

    let dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs.length).toBe(1);

    const cancelButton = await screen.findByRole('button', { name: 'Cancel' });
    await userEvent.click(cancelButton);

    dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs.length).toBe(0);

    expect(await confirmPromise).toBeFalse();
  });

  it('should open and confirm the dialog', async () => {
    const confirmPromise = DeleteDialogComponent.confirmDeletion(DATA, dialog);

    let dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs.length).toBe(1);

    const deleteButton = await screen.findByRole('button', { name: 'Delete!' });

    await userEvent.click(deleteButton);

    dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs.length).toBe(0);

    expect(await confirmPromise).toBeTrue();
  });
});
