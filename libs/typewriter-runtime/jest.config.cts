/* eslint-disable */
const { readFileSync } = require('fs');

const { exclude: _, ...swcJestConfig } = JSON.parse(
  readFileSync(`${__dirname}/.swcrc`, 'utf-8'),
);

if (swcJestConfig.swcrc === undefined) {
  swcJestConfig.swcrc = false;
}

// Inline maps keep coverage locations on TypeScript rather than generated helpers.
swcJestConfig.sourceMaps = 'inline';

module.exports = {
  displayName: 'typewriter-runtime',
  coverageThreshold: {
    global: require('../../tools/testing/coverage-thresholds.json')[
      'typewriter-runtime'
    ],
  },
  reporters: require('../../tools/testing/jest-reporters.cjs')(
    'typewriter-runtime',
  ),
  coverageDirectory: '../../.reports/libs/typewriter-runtime/coverage',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  transformIgnorePatterns: ['node_modules/(?!(uuid)/)'],
  moduleNameMapper: {
    '^@adaskothebeast/typewriter-schema$':
      '<rootDir>/../typewriter-schema/src/index.ts',
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  testEnvironment: 'node',
};
