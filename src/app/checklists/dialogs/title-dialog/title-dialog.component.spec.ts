import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed, inject } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TitleDialogComponent, TitleDialogData } from './title-dialog.component';

const DATA: TitleDialogData = {
  promptType: 'world',
  initialTitle: 'Earth',
};

describe('TitleDialogComponent', () => {
  let fixture: ComponentFixture<TitleDialogComponent>;
  let loader: HarnessLoader;
  let dialog: MatDialog;

  beforeEach(async () => {
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

    await dialogs[0].close();
    dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs.length).toBe(0);

    expect(await titlePromise).toBeUndefined();
  });

  // TODO: Add tests for return value when user confirms.
});
