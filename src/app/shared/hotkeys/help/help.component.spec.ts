import { ComponentFixture, TestBed, inject } from '@angular/core/testing';

import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { firstValueFrom } from 'rxjs';
import { HelpComponent } from './help.component';

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

    const openedDialog2 = HelpComponent.toggleHelp(dialog);
    expect(openedDialog2).toBeDefined();
    dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs).toHaveSize(1);

    const closedDialog2 = HelpComponent.toggleHelp(dialog);
    expect(closedDialog2).toBeUndefined();
    await firstValueFrom(openedDialog2!.afterClosed(), { defaultValue: null });

    dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs).toHaveSize(0);
  });
});
