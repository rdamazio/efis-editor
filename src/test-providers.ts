import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

// eslint-disable-next-line @typescript-eslint/no-deprecated
export default [provideHttpClientTesting(), provideNoopAnimations()];
