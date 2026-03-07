if (typeof process === 'undefined') {
  (globalThis as any).process = { env: {} };
}
