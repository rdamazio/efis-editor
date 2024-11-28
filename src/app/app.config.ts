import { ApplicationConfig } from '@angular/core';
import {
  PreloadAllModules,
  provideRouter,
  withEnabledBlockingInitialNavigation,
  withPreloading,
} from '@angular/router';

import { provideClientHydration, withIncrementalHydration } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ROUTES } from './app.routes';

export const APP_CONFIG: ApplicationConfig = {
  providers: [
    provideRouter(ROUTES, withEnabledBlockingInitialNavigation(), withPreloading(PreloadAllModules)),
    provideClientHydration(withIncrementalHydration()),
    provideAnimationsAsync(),
  ],
};
