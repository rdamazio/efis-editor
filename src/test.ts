import { NgModule, provideZoneChangeDetection } from '@angular/core';
import { getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import JasmineDOM from '@testing-library/jasmine-dom';

@NgModule({
  providers: [provideZoneChangeDetection()],
})
class GlobalProvidersModule {}

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(
  [BrowserTestingModule, GlobalProvidersModule, NoopAnimationsModule],
  platformBrowserTesting(),
);

// Install custom matchers from jasmine-dom
beforeAll(() => {
  jasmine.addMatchers(JasmineDOM);
});
