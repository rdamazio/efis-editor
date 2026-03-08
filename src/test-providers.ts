import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

export default [provideHttpClientTesting(), provideNoopAnimations()];
