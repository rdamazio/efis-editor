import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, inject, TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { screen } from '@testing-library/angular';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { UnsavedChangesDialogComponent } from './unsaved-changes-dialog.component';

describe('UnsavedChangesDialogComponent', () => {
  let user: UserEvent;
  let fixture: ComponentFixture<UnsavedChangesDialogComponent>;
  let loader: HarnessLoader;
  let dialog: MatDialog;

  beforeEach(async () => {
    user = userEvent.setup();

    await TestBed.configureTestingModule({
      imports: [UnsavedChangesDialogComponent, MatDialogModule],
      providers: [{ provide: MatDialogRef, useValue: {} }],
    }).compileComponents();

    fixture = TestBed.createComponent(UnsavedChangesDialogComponent);
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
    const confirmPromise = UnsavedChangesDialogComponent.confirmDiscard(dialog);

    let dialogs = await loader.getAllHarnesses(MatDialogHarness);

    expect(dialogs).toHaveLength(1);

    const keepEditingButton = await screen.findByRole('button', { name: 'Keep editing' });
    await user.click(keepEditingButton);

    dialogs = await loader.getAllHarnesses(MatDialogHarness);

    expect(dialogs).toHaveLength(0);

    await expect(confirmPromise).resolves.toBe(false);
  });

  it('should open and confirm the dialog', async () => {
    const confirmPromise = UnsavedChangesDialogComponent.confirmDiscard(dialog);

    let dialogs = await loader.getAllHarnesses(MatDialogHarness);

    expect(dialogs).toHaveLength(1);

    const discardButton = await screen.findByRole('button', { name: 'Discard changes' });

    await user.click(discardButton);

    dialogs = await loader.getAllHarnesses(MatDialogHarness);

    expect(dialogs).toHaveLength(0);

    await expect(confirmPromise).resolves.toBe(true);
  });
});
