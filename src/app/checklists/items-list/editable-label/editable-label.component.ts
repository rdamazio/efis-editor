import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule, MatLabel } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
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
    MatTooltipModule,
    ReactiveFormsModule,
  ],
  templateUrl: './editable-label.component.html',
  styleUrl: './editable-label.component.scss',
})
export class EditableLabelComponent {
  private readonly RESTRICTED_CHARS = ['~'];

  control = new FormControl('');
  private _savedValue = '';
  @ViewChild('promptInput') input!: ElementRef;

  @Output() cancelled = new EventEmitter<boolean>();
  @Output() editing = false;
  @Input() label = '';
  @Input() disallowEmpty = false;

  @Output() valueChange = new EventEmitter<string>();
  @Input()
  get value(): string {
    return this._savedValue;
  }
  set value(v: string) {
    this._savedValue = v;
    this.control.setValue(v);
  }

  save() {
    if (this.editing) {
      this.editing = false;
      this._savedValue = this.control.value!;
      this.valueChange.emit(this._savedValue);
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

  onBeforeInput(event: InputEvent) {
    // Prevent challenge/response separator (ACE format) from text input.
    if (event.data?.includes('~')) {
      event.preventDefault();
    }
  }
}
