import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { EditableLabelComponent } from './editable-label.component';

describe('EditableLabelComponent', () => {
  let component: EditableLabelComponent;
  let fixture: ComponentFixture<EditableLabelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditableLabelComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(EditableLabelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
