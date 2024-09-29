import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';
import { ChecklistTreeNodeComponent } from './node.component';

describe('NodeComponent', () => {
  let component: ChecklistTreeNodeComponent;
  let fixture: ComponentFixture<ChecklistTreeNodeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChecklistTreeNodeComponent, SweetAlert2Module.forRoot()],
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
