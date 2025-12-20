import { ComponentFixture, DeferBlockState } from '@angular/core/testing';
import { render, RenderResult, screen, within } from '@testing-library/angular';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  let rendered: RenderResult<AppComponent>;
  let fixture: ComponentFixture<AppComponent>;

  beforeEach(async () => {
    rendered = await render(AppComponent, {
      deferBlockStates: DeferBlockState.Complete,
    });
    fixture = rendered.fixture;
  });

  it('should create the app', () => {
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
    expect(app.title).toEqual('EFIS Editor');
  });

  it('should render the title', () => {
    const toolbar = screen.getByRole('toolbar');
    expect(toolbar).toBeVisible();
    expect(within(toolbar).getByRole('heading', { name: 'EFIS Editor' })).toBeVisible();
  });
});
