import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import 'zone.js';
import 'zone.js/testing';

vi.setConfig({ testTimeout: 60000 });

// Suppress console output other than warnings and errors, unless a test fails
const originalConsole = {
  log: console.log,
  info: console.info,
  debug: console.debug,
};

let logBuffer: { type: 'log' | 'info' | 'debug'; args: unknown[] }[] = [];

console.log = (...args: unknown[]) => logBuffer.push({ type: 'log', args });
console.info = (...args: unknown[]) => logBuffer.push({ type: 'info', args });
console.debug = (...args: unknown[]) => logBuffer.push({ type: 'debug', args });

beforeEach(() => {
  logBuffer = [];
});

afterEach(({ task }) => {
  if (task.result?.state === 'fail') {
    for (const log of logBuffer) {
      originalConsole[log.type](...log.args);
    }
  }
  logBuffer = [];
});
