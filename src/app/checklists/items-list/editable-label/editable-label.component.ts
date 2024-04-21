import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule, MatLabel } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatIconButtonSizesModule } from 'mat-icon-button-sizes';

@Component({
  selector: 'editable-label',
  standalone: true,
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconButtonSizesModule,
    MatIconModule,
    MatInputModule,
    MatLabel,
    ReactiveFormsModule,
  ],
  templateUrl: './editable-label.component.html',
  styleUrl: './editable-label.component.scss'
})
export class EditableLabelComponent {
  control = new FormControl('');
  private _savedValue = '';

  @Output() valueChanged = new EventEmitter<string>();
  @Output() cancelled = new EventEmitter<boolean>();
  @Output() editing = false;
  @Input() label: string = '';
  @Input() disallowEmpty = false;

  @Input()
  get value(): string { return this._savedValue; }
  set value(v: string) {
    this._savedValue = v;
    this.control.setValue(v);
  }

  save() {
    if (this.editing) {
      this.editing = false;
      this._savedValue = this.control.value!;
      this.valueChanged.emit(this._savedValue);
    }
  }

  edit() {
    this.editing = true;
  }

  cancel() {
    if (this.editing) {
      this.editing = false;
      this.control.setValue(this._savedValue);
      this.cancelled.emit(true);
    }
  }
}
