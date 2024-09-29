import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';
import { ChecklistsComponent } from './checklists.component';

describe('ChecklistsComponent', () => {
  let component: ChecklistsComponent;
  let fixture: ComponentFixture<ChecklistsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChecklistsComponent, NoopAnimationsModule, SweetAlert2Module.forRoot()],
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
