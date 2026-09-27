module.exports = {
  displayName: 'hierarchical-convert-core',
  coverageThreshold: {
    global: require('../../tools/testing/coverage-thresholds.json')[
      'hierarchical-convert-core'
    ],
  },
  reporters: require('../../tools/testing/jest-reporters.cjs')(
    'hierarchical-convert-core',
  ),
  coverageDirectory: '../../.reports/libs/hierarchical-convert-core/coverage',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': [
      '@swc/jest',
      {
        swcrc: false,
        jsc: { parser: { syntax: 'typescript' }, target: 'es2022' },
        module: { type: 'commonjs' },
      },
    ],
  },
};
