import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GoogleDriveComponent } from './gdrive.component';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';

describe('GoogleDriveComponent', () => {
  let component: GoogleDriveComponent;
  let fixture: ComponentFixture<GoogleDriveComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GoogleDriveComponent, SweetAlert2Module.forRoot()],
    }).compileComponents();

    fixture = TestBed.createComponent(GoogleDriveComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
