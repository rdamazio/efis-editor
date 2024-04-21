import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ChecklistsComponent } from './checklists.component';

describe('ChecklistsComponent', () => {
  let component: ChecklistsComponent;
  let fixture: ComponentFixture<ChecklistsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ChecklistsComponent,
        NoopAnimationsModule,
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(ChecklistsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
