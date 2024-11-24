import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed, inject } from '@angular/core/testing';

import { HarnessLoader } from '@angular/cdk/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ChecklistFileMetadata } from '../../../../../gen/ts/checklist';
import { ChecklistFileInfoComponent } from './file-info.component';

describe('ChecklistFileInfoComponent', () => {
  let fixture: ComponentFixture<ChecklistFileInfoComponent>;
  let loader: HarnessLoader;
  let dialog: MatDialog;
  const DATA = {
    metadata: ChecklistFileMetadata.create(),
    allGroups: [],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatDialogModule, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: {} },
        { provide: MAT_DIALOG_DATA, useValue: DATA },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChecklistFileInfoComponent);
    fixture.detectChanges();
    loader = TestbedHarnessEnvironment.documentRootLoader(fixture);
  });

  beforeEach(inject([MatDialog], (d: MatDialog) => {
    dialog = d;
  }));

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should open and close the dialog', async () => {
    dialog.open(ChecklistFileInfoComponent, { data: DATA });

    let dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs.length).toBe(1);

    await dialogs[0].close();
    dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs.length).toBe(0);
  });
});
