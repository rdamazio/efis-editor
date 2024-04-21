import { Component, EventEmitter, Input, Output } from '@angular/core';
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
  ],
  templateUrl: './editable-label.component.html',
  styleUrl: './editable-label.component.scss'
})
export class EditableLabelComponent {
  private _value: string = '';

  @Output() valueChanged = new EventEmitter<string>();
  @Output() cancelled = new EventEmitter<boolean>();
  @Output() editing = false;
  @Input() label: string = '';

  @Input()
  get value(): string { return this._value; }
  set value(v: string) {
    this._value = v;
    this.onValueChanged();
  }

  onValueChanged() {
    this.editing = false;
    this.valueChanged.emit(this._value);
  }

  onCancelled() {
    this.cancelled.emit(true);
  }

  edit() {
    this.editing = true;
  }

  cancel() {
    this.editing = false;
  }
}
