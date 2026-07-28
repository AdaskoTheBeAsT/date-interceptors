const { withNx } = require('@nx/rollup/with-nx');

// These options were migrated by @nx/rollup:convert-to-inferred from project.json
const options = {
  outputPath: '../../dist/libs/react-redux-toolkit-hierarchical-date-hook',
  tsConfig: './tsconfig.lib.json',
  project: './package.json',
  main: 'libs/react-redux-toolkit-hierarchical-date-hook/src/index.ts',
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    '@reduxjs/toolkit',
    'core-js',
  ],
  compiler: 'babel',
  assets: [
    {
      glob: 'libs/react-redux-toolkit-hierarchical-date-hook/README.md',
      input: '.',
      output: '.',
    },
  ],
};

let config = withNx(options, {
  // Provide additional rollup configuration here. See: https://rollupjs.org/configuration-options
  // e.g.
  // output: { sourcemap: true },
});

config = require('@nx/react/plugins/bundle-rollup')(config, options);

module.exports = config;
