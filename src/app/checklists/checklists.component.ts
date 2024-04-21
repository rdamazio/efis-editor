import { Component, ViewChild } from '@angular/core';
import { ChecklistTreeComponent } from './checklist-tree/checklist-tree.component';
import { ChecklistFilePickerComponent } from './file-picker/file-picker.component';
import { ChecklistItemsComponent } from './items-list/items-list.component';
import { Checklist, ChecklistFile } from '../../../gen/ts/checklist';
import { ChecklistStorage } from '../../model/storage/checklist-storage';

@Component({
  selector: 'app-checklists',
  standalone: true,
  imports: [
    ChecklistFilePickerComponent,
    ChecklistItemsComponent,
    ChecklistTreeComponent
  ],
  templateUrl: './checklists.component.html',
  styleUrl: './checklists.component.scss'
})
export class ChecklistsComponent {
  private _selectedFile? : ChecklistFile;

  constructor(public store: ChecklistStorage) {}

  onFileSelected(file?: ChecklistFile) {
    this._selectedFile = file;
  }

  onStructureChanged(file: ChecklistFile) {
    this.store.saveChecklistFile(file);
  }

  onChecklistChanged(checklist: Checklist) {
    if (this._selectedFile) {
      this.store.saveChecklistFile(this._selectedFile);
    }
  }
}
