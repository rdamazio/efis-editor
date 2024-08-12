import { Component, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatIconButtonSizesModule } from 'mat-icon-button-sizes';
import { ChecklistTreeComponent } from '../checklist-tree.component';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'checklist-tree-bar',
  standalone: true,
  imports: [MatButtonModule, MatIconButtonSizesModule, MatIconButtonSizesModule, MatIconModule, MatTooltipModule],
  templateUrl: './bar.component.html',
  styleUrl: './bar.component.scss',
})
export class ChecklistTreeBarComponent {
  @Input() tree?: ChecklistTreeComponent;
}
