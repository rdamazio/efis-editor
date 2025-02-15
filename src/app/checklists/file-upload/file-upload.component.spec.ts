import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChecklistFileUploadComponent } from './file-upload.component';

describe('ChecklistFileUploadComponent', () => {
  let component: ChecklistFileUploadComponent;
  let fixture: ComponentFixture<ChecklistFileUploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ChecklistFileUploadComponent] }).compileComponents();

    fixture = TestBed.createComponent(ChecklistFileUploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
