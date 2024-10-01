import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter, withEnabledBlockingInitialNavigation } from '@angular/router';

import { provideClientHydration } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withEnabledBlockingInitialNavigation()),
    provideClientHydration(),
    provideAnimationsAsync(),
    importProvidersFrom(
      SweetAlert2Module.forRoot({
        provideSwal: () => import('sweetalert2/dist/sweetalert2.js'),
      }),
    ),
  ],
};
