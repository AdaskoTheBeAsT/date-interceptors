import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

setupZoneTestEnv({
  errorOnUnknownElements: true,
  errorOnUnknownProperties: true,
});

// Polyfill for structuredClone (needed for Node < 17 and jsdom environment)
if (typeof structuredClone === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).structuredClone = function structuredClone(obj: unknown): unknown {
    return JSON.parse(JSON.stringify(obj));
  };
}
