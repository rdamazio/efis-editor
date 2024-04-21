import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChecklistItemsComponent } from './items-list.component';

describe('ChecklistItemsComponent', () => {
  let component: ChecklistItemsComponent;
  let fixture: ComponentFixture<ChecklistItemsComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ChecklistItemsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should compile', () => {
    expect(component).toBeTruthy();
  });
});
