import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { APP_CONFIG } from './app.config';

const SERVER_CONFIG: ApplicationConfig = { providers: [provideServerRendering()] };

export const CONFIG = mergeApplicationConfig(APP_CONFIG, SERVER_CONFIG);
