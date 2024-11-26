import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChecklistCommandBarComponent } from './command-bar.component';

describe('ChecklistCommandBarComponent', () => {
  let component: ChecklistCommandBarComponent;
  let fixture: ComponentFixture<ChecklistCommandBarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChecklistCommandBarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ChecklistCommandBarComponent);
    const componentRef = fixture.componentRef;
    componentRef.setInput('hasFiles', false);
    componentRef.setInput('fileIsOpen', false);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
