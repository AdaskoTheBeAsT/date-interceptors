const { withNx } = require('@nx/rollup/with-nx');
const dualPackage = require('../../tools/rollup/dual-package.cjs');
const nodeDeclarations = require('../../tools/rollup/node-declarations.cjs');

module.exports = dualPackage(
  withNx(
    {
      main: './src/index.ts',
      outputPath: '../../dist/libs/hierarchical-convert-to-dayjs',
      tsConfig: './tsconfig.lib.json',
      compiler: 'swc',
      project: './package.json',
      format: ['esm', 'cjs'],
      assets: [
        {
          input: 'libs/hierarchical-convert-to-dayjs',
          glob: 'README.md',
          output: '.',
        },
        {
          input: 'libs/hierarchical-convert-to-dayjs',
          glob: 'LICENSE',
          output: '.',
        },
      ],
    },
    {
      output: {
        // dayjs has no exports map, so Node's ESM loader needs file extensions.
        paths: (id) => (/^dayjs\/plugin\/[^.]+$/.test(id) ? `${id}.js` : id),
      },
      plugins: [nodeDeclarations()],
    },
  ),
);
