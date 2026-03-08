if (typeof process === 'undefined') {
  (globalThis as { process: unknown }).process = { env: {} };
}
