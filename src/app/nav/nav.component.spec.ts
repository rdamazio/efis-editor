import { ComponentFixture } from '@angular/core/testing';

import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { provideClientHydration, withIncrementalHydration } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { HotkeysService } from '@ngneat/hotkeys';
import { render, RenderResult, screen, within } from '@testing-library/angular';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { HelpComponent } from '../shared/hotkeys/help/help.component';
import { NavData } from './nav-data';
import { NavComponent } from './nav.component';

describe('NavComponent', () => {
  let user: UserEvent;
  let rendered: RenderResult<NavComponent>;
  let fixture: ComponentFixture<NavComponent>;
  let loader: HarnessLoader;
  let navData: NavData;
  let hotkeys: jasmine.SpyObj<HotkeysService>;
  let toggleHelp: jasmine.Spy;

  beforeEach(async () => {
    user = userEvent.setup();
    hotkeys = jasmine.createSpyObj<HotkeysService>('HotkeysService', ['getHotkeys', 'getShortcuts']);
    hotkeys.getHotkeys.and.returnValue([]);
    hotkeys.getShortcuts.and.returnValue([]);
    toggleHelp = spyOn(HelpComponent, 'toggleHelp');

    rendered = await render(NavComponent, {
      imports: [MatDialogModule, NoopAnimationsModule],
      providers: [
        {
          provide: HotkeysService,
          useValue: hotkeys,
        },
        provideClientHydration(withIncrementalHydration()),
      ],
    });
    fixture = rendered.fixture;
    navData = fixture.componentInstance.navData;
    loader = TestbedHarnessEnvironment.documentRootLoader(fixture);
  });

  it('should render', () => {
    const heading = screen.getByRole('heading');
    expect(heading).toBeVisible();
    expect(heading).toHaveTextContent(/EFIS Editor/);
  });

  it('should display title if set', async () => {
    navData.routeTitle.set('My route title');
    fixture.detectChanges();
    await fixture.whenStable();

    const heading = screen.getByRole('heading');
    expect(heading).toHaveTextContent(/EFIS Editor.*My route title/);
  });

  it('should display filename and title if set', async () => {
    navData.routeTitle.set('My route title');
    navData.fileName.set('My filename');
    fixture.detectChanges();
    await fixture.whenStable();

    const heading = screen.getByRole('heading');
    expect(heading).toHaveTextContent(/EFIS Editor.*My route title.*My filename/);
  });

  it('should update signal when a rename happens', async () => {
    navData.routeTitle.set('My route title');
    navData.fileName.set('My filename');
    fixture.detectChanges();
    await fixture.whenStable();

    const heading = screen.getByRole('heading');
    await user.click(within(heading).getByRole('button', { name: 'Rename file' }));

    const editBox = await screen.findByRole('textbox', { name: 'File name' });
    await user.clear(editBox);
    await user.type(editBox, 'Renamed file[Enter]');

    expect(navData.fileName()).toEqual('Renamed file');
  });

  it('should hide shortcuts icon when there are none', () => {
    expect(screen.queryByRole('button', { name: 'Show keyboard shorcuts' })).not.toBeInTheDocument();
  });

  it('should show shortcuts help when they exist and are clicked', async () => {
    hotkeys.getHotkeys.and.returnValue([
      {
        keys: 'shift.right',
        description: 'Shift something right',
        group: 'Main group',
      },
    ]);
    hotkeys.getShortcuts.and.returnValue([
      {
        group: 'Main group',
        hotkeys: [
          {
            keys: 'shift.right',
            description: 'Shift something right',
          },
        ],
      },
    ]);
    fixture.detectChanges();

    const button = screen.getByRole('button', { name: 'Show keyboard shortcuts' });
    expect(button).toBeVisible();

    await user.click(button);
    expect(toggleHelp).toHaveBeenCalledOnceWith(jasmine.any(MatDialog));
  });

  it('should show About dialog', async () => {
    const sidenavToggle = screen.getByRole('button', { name: 'Toggle sidenav' });
    expect(sidenavToggle).toBeVisible();
    await user.click(sidenavToggle);

    const aboutLink = await screen.findByText('About');
    expect(aboutLink).toBeVisible();
    await user.click(aboutLink);

    let dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs).toHaveSize(1);

    expect(screen.getByRole('img', { name: 'GitHub logo' })).toBeVisible();

    const okButton = screen.getByRole('button', { name: 'Ok' });
    expect(okButton).toBeVisible();
    await user.click(okButton);

    dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs).toHaveSize(0);
  });
});
