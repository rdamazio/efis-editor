import { Component } from '@angular/core';
import { ChecklistTreeComponent } from './checklist-tree/checklist-tree.component';
import { ChecklistFilePickerComponent } from './file-picker/file-picker.component';

@Component({
  selector: 'app-checklists',
  standalone: true,
  imports: [
    ChecklistFilePickerComponent,
    ChecklistTreeComponent
  ],
  templateUrl: './checklists.component.html',
  styleUrl: './checklists.component.scss'
})
export class ChecklistsComponent {
  // TODO: Wire file selection to tree
}
