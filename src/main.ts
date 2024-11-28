import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { APP_CONFIG } from './app/app.config';

bootstrapApplication(AppComponent, APP_CONFIG).catch(console.error.bind(console));
