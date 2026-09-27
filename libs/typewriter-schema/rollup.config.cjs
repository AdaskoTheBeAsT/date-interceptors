const { withNx } = require('@nx/rollup/with-nx');
const dualPackage = require('../../tools/rollup/dual-package.cjs');
const nodeDeclarations = require('../../tools/rollup/node-declarations.cjs');

module.exports = dualPackage(
  withNx(
    {
      main: './src/index.ts',
      outputPath: '../../dist/libs/typewriter-schema',
      tsConfig: './tsconfig.lib.json',
      compiler: 'swc',
      project: './package.json',
      format: ['esm', 'cjs'],
      assets: [
        { input: 'libs/typewriter-schema', glob: 'README.md', output: '.' },
        { input: 'libs/typewriter-schema', glob: 'LICENSE', output: '.' },
      ],
    },
    {
      plugins: [nodeDeclarations()],
    },
  ),
);
