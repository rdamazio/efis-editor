import { Component, EventEmitter, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';

@Component({
  selector: 'checklist-command-bar',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  templateUrl: './command-bar.component.html',
  styleUrl: './command-bar.component.scss'
})
export class ChecklistCommandBarComponent {
  @Output() newFile = new EventEmitter<boolean>();
  @Output() openFile = new EventEmitter<boolean>();
  @Output() uploadFile = new EventEmitter<boolean>();
  @Output() downloadFile = new EventEmitter<boolean>();
}
