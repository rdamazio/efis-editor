import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed, inject } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { screen } from '@testing-library/angular';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { TitleDialogComponent, TitleDialogData } from './title-dialog.component';

const DATA: TitleDialogData = { promptType: 'world', initialTitle: 'Earth' };

describe('TitleDialogComponent', () => {
  let user: UserEvent;
  let fixture: ComponentFixture<TitleDialogComponent>;
  let loader: HarnessLoader;
  let dialog: MatDialog;

  beforeEach(async () => {
    user = userEvent.setup();

    await TestBed.configureTestingModule({
      imports: [TitleDialogComponent, MatDialogModule, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: {} },
        { provide: MAT_DIALOG_DATA, useValue: DATA },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TitleDialogComponent);
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
    const titlePromise = TitleDialogComponent.promptForTitle(DATA, dialog);

    let dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs.length).toBe(1);

    const titleBox = await screen.findByRole('textbox', { name: 'Title' });
    await user.type(titleBox, ' is home');

    const cancelButton = await screen.findByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs.length).toBe(0);

    expect(await titlePromise).toBeUndefined();
  });

  it('should open and confirm the dialog', async () => {
    const titlePromise = TitleDialogComponent.promptForTitle(DATA, dialog);

    let dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs.length).toBe(1);

    const titleBox = await screen.findByRole('textbox', { name: 'Title' });
    await user.type(titleBox, ' is home');

    const okButton = await screen.findByRole('button', { name: 'Ok' });
    await user.click(okButton);

    dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs.length).toBe(0);

    expect(await titlePromise).toEqual('Earth is home');
  });
});
