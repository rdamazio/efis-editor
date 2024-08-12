import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChecklistTreeBarComponent } from './bar.component';

describe('ChecklistTreeBarComponent', () => {
  let component: ChecklistTreeBarComponent;
  let fixture: ComponentFixture<ChecklistTreeBarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChecklistTreeBarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ChecklistTreeBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
