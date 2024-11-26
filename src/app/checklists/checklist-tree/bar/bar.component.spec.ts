import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChecklistTreeBarComponent } from './bar.component';
import { ChecklistTreeComponent } from '../checklist-tree.component';

describe('ChecklistTreeBarComponent', () => {
  let component: ChecklistTreeBarComponent;
  let fixture: ComponentFixture<ChecklistTreeBarComponent>;
  let tree: jasmine.SpyObj<ChecklistTreeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChecklistTreeBarComponent],
    }).compileComponents();

    tree = jasmine.createSpyObj<ChecklistTreeComponent>('ChecklistTreeComponent', [
      'isAllExpanded',
      'expandAll',
      'isAllCollapsed',
      'collapseAll',
    ]);

    fixture = TestBed.createComponent(ChecklistTreeBarComponent);
    fixture.componentRef.setInput('tree', tree);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
