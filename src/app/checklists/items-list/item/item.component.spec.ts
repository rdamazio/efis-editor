import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChecklistItemComponent } from './item.component';
import { ChecklistItem } from '../../../../../gen/ts/checklist';

describe('ChecklistItemComponent', () => {
  let component: ChecklistItemComponent;
  let fixture: ComponentFixture<ChecklistItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChecklistItemComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ChecklistItemComponent);
    fixture.componentRef.setInput('item', ChecklistItem.create());
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
