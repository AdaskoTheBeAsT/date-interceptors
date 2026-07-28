const { withNx } = require('@nx/rollup/with-nx');

// These options were migrated by @nx/rollup:convert-to-inferred from project.json
const options = {
  main: './src/index.ts',
  outputPath: '../../dist/libs/typewriter-http-axios',
  tsConfig: './tsconfig.lib.json',
  compiler: 'swc',
  project: './package.json',
  format: ['esm'],
  assets: [
    {
      glob: 'libs/typewriter-http-axios/README.md',
      input: '.',
      output: '.',
    },
    {
      glob: 'LICENSE',
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
