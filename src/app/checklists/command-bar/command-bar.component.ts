import { NgFor } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';

export interface DownloadFormat {
  id: string;
  name: string;
}

@Component({
  selector: 'checklist-command-bar',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule, NgFor, SweetAlert2Module],
  templateUrl: './command-bar.component.html',
  styleUrl: './command-bar.component.scss',
})
export class ChecklistCommandBarComponent {
  @Input() hasFiles = false;
  @Input() fileIsOpen = false;
  @Input() downloadFormats: DownloadFormat[] = [];
  @Output() newFile = new EventEmitter<string>(); // Emits filename
  @Output() openFile = new EventEmitter<boolean>();
  @Output() uploadFile = new EventEmitter<boolean>();
  @Output() downloadFile = new EventEmitter<string>();
  @Output() deleteFile = new EventEmitter<boolean>();
  @Output() fileInfo = new EventEmitter<boolean>();

  isValidFileName(name: string): string | undefined {
    if (!name) {
      return 'A name must be provided!';
    }
    return undefined;
  }
}
