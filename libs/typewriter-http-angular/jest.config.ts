const reportPath = '.reports/libs/typewriter-http-angular/';
const reportName = 'test-report';

export default {
  displayName: 'typewriter-http-angular',
  preset: '../../jest.preset.js',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
        useESM: true,
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!uuid/|.*\\.mjs$)'],
  moduleNameMapper: {
    '^@adaskothebeast/typewriter-runtime$':
      '<rootDir>/../typewriter-runtime/src/index.ts',
    '^@adaskothebeast/typewriter-schema$':
      '<rootDir>/../typewriter-schema/src/index.ts',
  },
  snapshotSerializers: [
    'jest-preset-angular/build/serializers/no-ng-attributes',
    'jest-preset-angular/build/serializers/ng-snapshot',
    'jest-preset-angular/build/serializers/html-comment',
  ],
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
        relativeRootDir: './',
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
