const nxPreset = require('@nx/jest/preset').default;

module.exports = {
  ...nxPreset,
  collectCoverage: true,
  collectCoverageFrom: [
    '<rootDir>/src/**/*.ts',
    '!<rootDir>/src/**/*.spec.ts',
    '!<rootDir>/src/test-setup.ts',
    '!<rootDir>/src/**/fixtures/**',
  ],
  coverageReporters: ['text', 'lcov', 'json-summary', 'cobertura'],
};
