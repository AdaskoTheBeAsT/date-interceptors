const { withNx } = require('@nx/rollup/with-nx');

// These options were migrated by @nx/rollup:convert-to-inferred from project.json
const options = {
  main: './src/index.ts',
  outputPath: '../../dist/libs/hierarchical-convert-to-uuid',
  tsConfig: './tsconfig.lib.json',
  compiler: 'swc',
  project: './package.json',
  format: ['esm'],
  assets: [
    {
      glob: 'libs/hierarchical-convert-to-uuid/README.md',
      input: '.',
      output: '.',
    },
  ],
};

const config = withNx(options, {
  // Provide additional rollup configuration here. See: https://rollupjs.org/configuration-options
  // e.g.
  // output: { sourcemap: true },
});

module.exports = config;
