import { Component } from '@angular/core';
import { NavComponent } from './nav/nav.component';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    NavComponent,
  ],
  template: "<app-nav />",
})
export class AppComponent {
  title = 'EFIS Editor';
}
