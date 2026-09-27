module.exports = (library) => [
  'default',
  [
    'jest-junit',
    {
      outputDirectory: `.reports/libs/${library}`,
      outputName: 'test-report.junit.xml',
    },
  ],
  [
    'jest-sonar',
    {
      outputDirectory: `.reports/libs/${library}`,
      outputName: 'test-report.sonar.xml',
      reportedFilePath: 'relative',
      relativeRootDir: './',
    },
  ],
];
