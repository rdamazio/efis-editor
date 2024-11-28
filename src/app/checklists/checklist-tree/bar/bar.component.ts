import { Component, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconButtonSizesModule } from 'mat-icon-button-sizes';
import { ChecklistTreeComponent } from '../checklist-tree.component';

@Component({
  selector: 'checklist-tree-bar',
  imports: [MatButtonModule, MatIconButtonSizesModule, MatIconModule, MatTooltipModule],
  templateUrl: './bar.component.html',
  styleUrl: './bar.component.scss',
})
export class ChecklistTreeBarComponent {
  readonly tree = input.required<ChecklistTreeComponent>();
}
