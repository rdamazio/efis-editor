import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { ChecklistsComponent } from './checklists.component';

describe('ChecklistsComponent', () => {
  let component: ChecklistsComponent;
  let fixture: ComponentFixture<ChecklistsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChecklistsComponent, NoopAnimationsModule],
      providers: [provideRouter([{ path: 'checklists', component: ChecklistsComponent }])],
    }).compileComponents();

    fixture = TestBed.createComponent(ChecklistsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
