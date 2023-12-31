/* eslint-disable */
const reportPath = '.reports/libs/react-redux-toolkit-hierarchical-date-hook/';

export default {
  displayName: 'react-redux-toolkit-hierarchical-date-hook',
  preset: '../../jest.preset.js',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/react/babel'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  testEnvironment: './FixJSDOMEnvironment.ts',
  collectCoverage: true,
  coverageDirectory: `../../${reportPath}coverage`,
  coverageReporters: ['cobertura', 'html', 'lcov'],
  reporters: [
    'default',
    [
      'jest-stare',
      {
        resultDir: reportPath,
        reportTitle: 'Frontend test',
        additionalResultsProcessors: [],
        coverageLink: 'coverage/index.html',
        resultJson: 'frontend.stare.json',
        resultHtml: 'frontend.stare.html',
        report: true,
        reportSummary: true,
      },
    ],
    [
      'jest-html-reporters',
      {
        publicPath: reportPath,
        filename: 'frontend-test-report.html',
        pageTitle: 'Frontend test',
        expand: true,
      },
    ],
    [
      'jest-xunit',
      {
        outputPath: reportPath,
        filename: 'frontend-test-report.xunit.xml',
        traitsRegex: [
          { regex: /\(Test Type:([^,)]+)(,|\)).*/g, name: 'Category' },
          { regex: /.*Test Traits: ([^)]+)\).*/g, name: 'Type' },
        ],
      },
    ],
    [
      'jest-sonar',
      {
        outputDirectory: reportPath,
        outputName: 'frontend-test.sonar.xml',
      },
    ],
    [
      'jest-trx-results-processor',
      {
        outputFile: `${reportPath}frontend-test.trx`,
      },
    ],
    [
      'jest-junit',
      {
        outputDirectory: reportPath,
        outputName: 'frontend-test.junit.xml',
      },
    ],
  ],
};
