import { getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import JasmineDOM from '@testing-library/jasmine-dom';

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting(), {});

// Install custom matchers from jasmine-dom
beforeAll(() => {
  jasmine.addMatchers(JasmineDOM);
});
