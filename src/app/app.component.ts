import { Component, OnInit } from '@angular/core';
import { NavComponent } from './nav/nav.component';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [MatIconModule, NavComponent],
  template: '<app-nav />',
})
export class AppComponent implements OnInit {
  title = 'EFIS Editor';

  constructor(private matIconRegistry: MatIconRegistry) {}

  ngOnInit(): void {
    this.matIconRegistry.setDefaultFontSetClass('material-symbols-outlined');
  }
}
