import { Component, ViewChild } from '@angular/core';
import { Checklist, ChecklistFile } from '../../../gen/ts/checklist';
import { ChecklistStorage } from '../../model/storage/checklist-storage';
import { ChecklistTreeComponent } from './checklist-tree/checklist-tree.component';
import { ChecklistFilePickerComponent } from './file-picker/file-picker.component';
import { ChecklistItemsComponent } from './items-list/items-list.component';

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
  private _selectedFile?: ChecklistFile;
  @ViewChild("tree") tree?: ChecklistTreeComponent;

  constructor(public store: ChecklistStorage) { }

  onFileSelected(id: string) {
    let file: ChecklistFile | undefined;
    if (id) {
      file = this.store.getChecklistFile(id);
    }
    this._selectedFile = file;
    this.tree!.file = file;
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
