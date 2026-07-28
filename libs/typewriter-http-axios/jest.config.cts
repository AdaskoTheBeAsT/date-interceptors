/* eslint-disable */
const { readFileSync } = require('fs')

const { exclude: _, ...swcJestConfig } = JSON.parse(
  readFileSync(`${__dirname}/.swcrc`, 'utf-8')
);

if (swcJestConfig.swcrc === undefined) {
    swcJestConfig.swcrc = false;
}

module.exports = {
  displayName: 'typewriter-http-axios',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  transformIgnorePatterns: ['node_modules/(?!(uuid)/)'],
  moduleNameMapper: {
    '^@adaskothebeast/typewriter-runtime$':
      '<rootDir>/../typewriter-runtime/src/index.ts',
    '^@adaskothebeast/typewriter-schema$':
      '<rootDir>/../typewriter-schema/src/index.ts',
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  testEnvironment: 'node',
  coverageDirectory: '../../coverage/libs/typewriter-http-axios'
};
