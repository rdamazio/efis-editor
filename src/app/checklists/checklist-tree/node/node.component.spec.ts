import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChecklistTreeNodeComponent } from './node.component';

describe('NodeComponent', () => {
  let component: ChecklistTreeNodeComponent;
  let fixture: ComponentFixture<ChecklistTreeNodeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChecklistTreeNodeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ChecklistTreeNodeComponent);
    component = fixture.componentInstance;
    component.node = {
      isAddNew: false,
      title: 'Test',
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
