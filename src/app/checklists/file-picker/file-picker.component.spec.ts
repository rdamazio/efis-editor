import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChecklistFilePickerComponent } from './file-picker.component';

describe('FilePickerComponent', () => {
  let component: ChecklistFilePickerComponent;
  let fixture: ComponentFixture<ChecklistFilePickerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChecklistFilePickerComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ChecklistFilePickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
