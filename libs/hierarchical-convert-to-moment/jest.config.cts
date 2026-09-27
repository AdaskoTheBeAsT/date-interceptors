const coverageThresholds = require('../../tools/testing/coverage-thresholds.json');

const reportPath = '../../.reports/libs/hierarchical-convert-to-moment/';
const reportName = 'test-report';

module.exports = {
  displayName: 'hierarchical-convert-to-moment',
  coverageThreshold: {
    global: coverageThresholds['hierarchical-convert-to-moment'],
  },
  coverageDirectory:
    '../../.reports/libs/hierarchical-convert-to-moment/coverage',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': require('../../tools/testing/swc-transform.cjs'),
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  collectCoverage: true,
  reporters: [
    'default',
    [
      'jest-stare',
      {
        resultDir: reportPath,
        reportTitle: 'Frontend test',
        additionalResultsProcessors: [],
        coverageLink: 'coverage/index.html',
        resultJson: `${reportName}.stare.json`,
        resultHtml: `${reportName}.stare.html`,
        report: true,
        reportSummary: true,
      },
    ],
    [
      'jest-html-reporters',
      {
        publicPath: reportPath,
        filename: `${reportName}.html`,
        pageTitle: 'Frontend test',
        expand: true,
      },
    ],
    [
      'jest-xunit',
      {
        outputPath: reportPath,
        filename: `${reportName}.xunit.xml`,
        traitsRegex: [
          { regex: /\(Test Type:([^,)]+)[,)].*/g, name: 'Category' },
          { regex: /.*Test Traits: ([^)]+)\).*/g, name: 'Type' },
        ],
      },
    ],
    [
      'jest-sonar',
      {
        outputDirectory: reportPath,
        outputName: `${reportName}.sonar.xml`,
        reportedFilePath: 'relative',
        relativeRootDir: '../../',
      },
    ],
    [
      'jest-trx-results-processor',
      {
        outputFile: `${reportPath}${reportName}.trx`,
      },
    ],
    [
      'jest-junit',
      {
        outputDirectory: reportPath,
        outputName: `${reportName}.junit.xml`,
      },
    ],
  ],
};
