import { Component, ElementRef, input, model, output, viewChild } from '@angular/core';
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
  readonly input = viewChild.required<ElementRef<HTMLElement>>('promptInput');

  readonly cancelled = output<boolean>();
  readonly editing = model<boolean>();
  readonly value = model('');
  readonly label = input('');
  readonly disallowEmpty = input(false);

  constructor() {
    this.editing.set(false);
  }

  save() {
    if (this.editing()) {
      this.editing.set(false);
      this.value.set(this.control.value!);
    }
  }

  edit() {
    this.control.setValue(this.value());
    this.editing.set(true);
  }

  focus() {
    // setTimeout is needed to remove focusing from the execution stack and allow the input element to be created first
    // See https://v17.angular.io/api/core/ViewChild for the details.
    setTimeout(() => {
      if (this.editing()) {
        this.input().nativeElement.focus();
      }
    });
  }

  cancel() {
    if (this.editing()) {
      this.editing.set(false);
      this.control.setValue(this.value());
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
