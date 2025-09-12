/* eslint-disable @typescript-eslint/naming-convention */

import { bootstrapApplication, BootstrapContext } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { CONFIG } from './app/app.config.server';

const bootstrap = async (context: BootstrapContext) => bootstrapApplication(AppComponent, CONFIG, context);

export default bootstrap;
