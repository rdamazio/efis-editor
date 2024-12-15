import { ComponentFixture } from '@angular/core/testing';

import { render, screen } from '@testing-library/angular';
import { NavData } from './nav-data';
import { NavComponent } from './nav.component';

describe('NavComponent', () => {
  let fixture: ComponentFixture<NavComponent>;
  let navData: NavData;

  beforeEach(async () => {
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
});
