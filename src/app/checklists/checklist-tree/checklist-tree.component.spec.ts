import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChecklistTreeComponent } from './checklist-tree.component';

describe('ChecklistTreeComponent', () => {
  let component: ChecklistTreeComponent;
  let fixture: ComponentFixture<ChecklistTreeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChecklistTreeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ChecklistTreeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
