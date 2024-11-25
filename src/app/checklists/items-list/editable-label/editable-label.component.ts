import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule, MatLabel } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconButtonSizesModule } from 'mat-icon-button-sizes';
import { DynamicDataPipe } from './dynamic-data.pipe';

@Component({
  selector: 'editable-label',
  imports: [
    DynamicDataPipe,
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
  @ViewChild('promptInput') input!: ElementRef<HTMLElement>;

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

  focus() {
    // setTimeout is needed to remove focusing from the execution stack and allow the input element to be created first
    // See https://v17.angular.io/api/core/ViewChild for the details.
    setTimeout(() => {
      if (this.editing) {
        this.input.nativeElement.focus();
      }
    });
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
