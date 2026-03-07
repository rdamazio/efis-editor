import { ComponentFixture, DeferBlockState } from '@angular/core/testing';
import type { Mock, MockedObject } from 'vitest';

import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDialogHarness } from '@angular/material/dialog/testing';
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
  let hotkeys: MockedObject<HotkeysService>;
  let toggleHelp: Mock;

  beforeEach(async () => {
    user = userEvent.setup();
    hotkeys = {
      getHotkeys: vi.fn().mockName('HotkeysService.getHotkeys'),
      getShortcuts: vi.fn().mockName('HotkeysService.getShortcuts'),
    };
    hotkeys.getHotkeys.mockReturnValue([]);
    hotkeys.getShortcuts.mockReturnValue([]);
    toggleHelp = vi.spyOn(HelpComponent, 'toggleHelp');

    rendered = await render(NavComponent, {
      imports: [MatDialogModule],
      providers: [
        {
          provide: HotkeysService,
          useValue: hotkeys,
        },
      ],
      deferBlockStates: DeferBlockState.Complete,
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
    hotkeys.getHotkeys.mockReturnValue([
      {
        keys: 'shift.right',
        description: 'Shift something right',
        group: 'Main group',
      },
    ]);
    hotkeys.getShortcuts.mockReturnValue([
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
    expect(toggleHelp).toHaveBeenCalledTimes(1);
    expect(toggleHelp).toHaveBeenCalledWith(expect.any(MatDialog));
  });

  it('should show About dialog', async () => {
    const sidenavToggle = screen.getByRole('button', { name: 'Toggle sidenav' });
    expect(sidenavToggle).toBeVisible();
    await user.click(sidenavToggle);

    const aboutLink = await screen.findByText('About');
    expect(aboutLink).toBeVisible();
    await user.click(aboutLink);

    let dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs).toHaveLength(1);

    expect(screen.getByRole('img', { name: 'GitHub logo' })).toBeVisible();

    const okButton = screen.getByRole('button', { name: 'Ok' });
    expect(okButton).toBeVisible();
    await user.click(okButton);

    dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs).toHaveLength(0);
  });
});
