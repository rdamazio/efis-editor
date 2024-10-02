import { Component, OnInit } from '@angular/core';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { NavComponent } from './nav/nav.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [MatIconModule, NavComponent],
  template: '<app-nav />',
})
export class AppComponent implements OnInit {
  title = 'EFIS Editor';

  constructor(private readonly _matIconRegistry: MatIconRegistry) {}

  ngOnInit(): void {
    this._matIconRegistry.setDefaultFontSetClass('material-symbols-outlined');
  }
}
