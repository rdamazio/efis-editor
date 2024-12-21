import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GoogleDriveComponent } from './gdrive.component';

describe('GoogleDriveComponent', () => {
  let component: GoogleDriveComponent;
  let fixture: ComponentFixture<GoogleDriveComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GoogleDriveComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GoogleDriveComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
