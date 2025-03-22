import { ComponentFixture, TestBed, inject } from '@angular/core/testing';

import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { HelpComponent } from './help.component';
import { firstValueFrom } from 'rxjs';

describe('HelpComponent', () => {
  let fixture: ComponentFixture<HelpComponent>;
  let loader: HarnessLoader;
  let dialog: MatDialog;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HelpComponent, MatDialogModule],
      providers: [{ provide: MatDialogRef, useValue: {} }],
    }).compileComponents();

    fixture = TestBed.createComponent(HelpComponent);
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
    dialog.open(HelpComponent);

    let dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs).toHaveSize(1);

    await dialogs[0].close();
    dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs).toHaveSize(0);
  });

  it('should toggle the dialog', async () => {
    const openedDialog = HelpComponent.toggleHelp(dialog);
    expect(openedDialog).toBeDefined();
    let dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs).toHaveSize(1);

    const closedDialog = HelpComponent.toggleHelp(dialog);
    expect(closedDialog).toBeUndefined();
    await firstValueFrom(openedDialog!.afterClosed(), { defaultValue: null });

    dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs).toHaveSize(0);
  });
});
