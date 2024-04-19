import { Component } from '@angular/core';
import { NavComponent } from './nav/nav.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

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
