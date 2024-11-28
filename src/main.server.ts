/* eslint-disable @typescript-eslint/naming-convention */

import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { CONFIG } from './app/app.config.server';

const bootstrap = async () => bootstrapApplication(AppComponent, CONFIG);

export default bootstrap;
