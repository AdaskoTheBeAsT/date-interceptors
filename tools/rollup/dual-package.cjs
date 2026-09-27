const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const entryFields = ['type', 'main', 'module', 'types', 'typings', 'exports'];

/**
 * Turns a `withNx` config with `format: ['esm', 'cjs']` into a dual package:
 * "type": "module", ESM in `<entry>.esm.js`, CommonJS in `<entry>.cjs`, and a
 * conditional `exports` map whose `require` branch points at the `.d.cts`
 * declarations produced by node-declarations.cjs.
 *
 * `withNx` refuses to emit both formats when the source manifest declares a
 * "type", and it names CommonJS output `*.cjs.js`, which Node would load as
 * ESM inside a "type": "module" package. Both are fixed up here.
 */
module.exports = function dualPackage(config) {
  const outputs = Array.isArray(config.output)
    ? config.output
    : [config.output];
  const formats = outputs.map((output) => output.format);
  if (!formats.includes('es') && !formats.includes('esm')) {
    throw new Error('dualPackage requires an "esm" output.');
  }
  if (!formats.includes('cjs')) {
    throw new Error('dualPackage requires a "cjs" output.');
  }
  return {
    ...config,
    output: outputs.map((output) =>
      output.format === 'cjs'
        ? {
            ...output,
            entryFileNames: '[name].cjs',
            chunkFileNames: '[name]-[hash].cjs',
          }
        : output,
    ),
    plugins: [...(config.plugins ?? []), dualPackageManifest()],
  };
};

function dualPackageManifest() {
  const entries = { esm: new Map(), cjs: new Map() };
  return {
    name: 'dual-package-manifest',
    writeBundle: {
      order: 'post',
      sequential: true,
      handler(output, bundle) {
        const format = output.format === 'cjs' ? 'cjs' : 'esm';
        for (const chunk of Object.values(bundle)) {
          if (chunk.type === 'chunk' && chunk.isEntry) {
            entries[format].set(chunk.name, `./${chunk.fileName}`);
          }
        }
        const file = join(output.dir, 'package.json');
        const manifest = JSON.parse(readFileSync(file, 'utf8'));
        writeFileSync(
          file,
          `${JSON.stringify(withEntryFields(manifest, entries), null, 2)}\n`,
        );
      },
    },
  };
}

function withEntryFields(manifest, entries) {
  const mainEsm = entries.esm.get('index');
  const mainCjs = entries.cjs.get('index');
  const exports = { './package.json': './package.json' };
  for (const name of new Set([...entries.esm.keys(), ...entries.cjs.keys()])) {
    const subpath = name === 'index' ? '.' : `./${name}`;
    const esm = entries.esm.get(name);
    const cjs = entries.cjs.get(name);
    exports[subpath] = {
      ...(esm && {
        import: { types: `./${name}.d.ts`, default: esm },
      }),
      ...(cjs && {
        require: { types: `./${name}.d.cts`, default: cjs },
      }),
    };
  }
  const fields = {
    type: 'module',
    ...(mainCjs && { main: mainCjs }),
    ...(mainEsm && { module: mainEsm }),
    types: './index.d.ts',
    exports,
  };
  const result = {};
  let inserted = false;
  const insert = () => {
    Object.assign(result, fields);
    inserted = true;
  };
  for (const [key, value] of Object.entries(manifest)) {
    if (entryFields.includes(key)) continue;
    result[key] = value;
    if (key === 'homepage') insert();
  }
  if (!inserted) insert();
  return result;
}
