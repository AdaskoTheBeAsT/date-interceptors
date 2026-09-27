const { withNx } = require('@nx/rollup/with-nx');
const dualPackage = require('../../tools/rollup/dual-package.cjs');
const nodeDeclarations = require('../../tools/rollup/node-declarations.cjs');

module.exports = dualPackage(
  withNx(
    {
      main: './src/index.ts',
      outputPath: '../../dist/libs/hierarchical-convert-core',
      tsConfig: './tsconfig.lib.json',
      compiler: 'swc',
      project: './package.json',
      format: ['esm', 'cjs'],
      assets: [
        {
          input: 'libs/hierarchical-convert-core',
          glob: 'README.md',
          output: '.',
        },
        {
          input: 'libs/hierarchical-convert-core',
          glob: 'LICENSE',
          output: '.',
        },
      ],
    },
    {
      plugins: [nodeDeclarations()],
    },
  ),
);
