import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';
import { ChecklistCommandBarComponent } from './command-bar.component';

describe('ChecklistCommandBarComponent', () => {
  let component: ChecklistCommandBarComponent;
  let fixture: ComponentFixture<ChecklistCommandBarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChecklistCommandBarComponent, SweetAlert2Module.forRoot()],
    }).compileComponents();

    fixture = TestBed.createComponent(ChecklistCommandBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
