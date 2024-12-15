import { ComponentFixture } from '@angular/core/testing';

import { render, screen, within } from '@testing-library/angular';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { NavData } from './nav-data';
import { NavComponent } from './nav.component';

describe('NavComponent', () => {
  let user: UserEvent;
  let fixture: ComponentFixture<NavComponent>;
  let navData: NavData;

  beforeEach(async () => {
    user = userEvent.setup();
    ({ fixture } = await render(NavComponent));
    navData = fixture.componentInstance.navData;
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
});
