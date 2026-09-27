const { withNx } = require('@nx/rollup/with-nx');
const dualPackage = require('../../tools/rollup/dual-package.cjs');
const nodeDeclarations = require('../../tools/rollup/node-declarations.cjs');

module.exports = dualPackage(
  withNx(
    {
      main: './src/index.ts',
      outputPath: '../../dist/libs/react-redux-toolkit-hierarchical-date-hook',
      tsConfig: './tsconfig.lib.json',
      compiler: 'babel',
      project: './package.json',
      format: ['esm', 'cjs'],
      external: ['react/jsx-runtime'],
      assets: [
        {
          input: 'libs/react-redux-toolkit-hierarchical-date-hook',
          glob: 'README.md',
          output: '.',
        },
        {
          input: 'libs/react-redux-toolkit-hierarchical-date-hook',
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
