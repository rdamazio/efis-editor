import * as matchers from '@testing-library/jest-dom/matchers';
import { afterEach, beforeEach, expect, vi } from 'vitest';
import 'zone.js';
import 'zone.js/testing';

// TODO: Switch back to `import '@testing-library/jest-dom/vitest'` and remove this once
// https://github.com/testing-library/jest-dom/pull/742 is fixed.
declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Assertion<R, T> extends matchers.TestingLibraryMatchers<T, R> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends matchers.TestingLibraryMatchers<unknown, unknown> {}
}

expect.extend(matchers);

vi.setConfig({ testTimeout: 60000 });

/* eslint-disable no-console */
// Suppress console output other than warnings and errors, unless a test fails
const ORIGINAL_CONSOLE = {
  log: console.log,
  info: console.info,
  debug: console.debug,
};

let logBuffer: { type: 'log' | 'info' | 'debug'; args: unknown[] }[] = [];

console.log = (...args: unknown[]) => {
  logBuffer.push({ type: 'log', args });
};
console.info = (...args: unknown[]) => {
  logBuffer.push({ type: 'info', args });
};
console.debug = (...args: unknown[]) => {
  logBuffer.push({ type: 'debug', args });
};

beforeEach(() => {
  logBuffer = [];
});

afterEach(({ task }) => {
  if (task.result?.state === 'fail') {
    for (const log of logBuffer) {
      ORIGINAL_CONSOLE[log.type](...log.args);
    }
  }
  logBuffer = [];
});
/* eslint-enable no-console */
