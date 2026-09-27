import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import semver from 'semver';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const consumer = mkdtempSync(join(tmpdir(), 'date-converters-consumer-'));
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const writeJson = (file, value) =>
  writeFileSync(file, JSON.stringify(value, null, 2));
function run(command, args, cwd = consumer, env = process.env) {
  if (process.platform === 'win32' && command === 'npm') {
    const npmCli = join(
      dirname(process.execPath),
      'node_modules/npm/bin/npm-cli.js',
    );
    if (!existsSync(npmCli))
      throw new Error(`Cannot locate npm CLI at ${npmCli}`);
    return run(process.execPath, [npmCli, ...args], cwd, env);
  }
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed\n${result.error ?? ''}\n${result.stdout}\n${result.stderr}`,
    );
  }
  return result.stdout;
}

console.log(`Testing packed packages in ${consumer}`);
const dependencies = {};
const names = [];
const peerProfile = process.argv.includes('--minimum-peers')
  ? 'minimum'
  : 'locked';
const peerRanges = new Map();
const manifests = readdirSync(join(root, 'libs'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map(({ name: library }) => ({
    library,
    manifest: json(join(root, 'dist/libs', library, 'package.json')),
  }));
for (const { library, manifest } of manifests) {
  const packed = JSON.parse(
    run(
      'npm',
      ['pack', '--json', '--ignore-scripts', '--pack-destination', consumer],
      join(root, 'dist/libs', library),
    ),
  )[0];
  const files = new Set(packed.files.map(({ path }) => path));
  assert(files.has('LICENSE'), `${manifest.name} must include LICENSE`);
  assert(
    manifest.exports?.['.'],
    `${manifest.name} must export its public entry`,
  );
  if (!existsSync(join(root, 'libs', library, 'ng-package.json'))) {
    for (const condition of ['import', 'require']) {
      const entry = manifest.exports['.'][condition];
      assert(
        entry?.types && entry.default,
        `${manifest.name}: missing ${condition} entry`,
      );
      for (const target of [entry.types, entry.default]) {
        assert(
          files.has(target.replace(/^\.\//, '')),
          `${manifest.name}: missing ${target}`,
        );
      }
    }
  }
  dependencies[manifest.name] =
    `file:${join(consumer, packed.filename).replaceAll('\\', '/')}`;
  names.push(manifest.name);
}
for (const { manifest } of manifests) {
  for (const [peer, range] of Object.entries(manifest.peerDependencies ?? {})) {
    if (!names.includes(peer)) {
      const ranges = peerRanges.get(peer) ?? [];
      ranges.push(range);
      peerRanges.set(peer, ranges);
    }
  }
}
for (const [peer, ranges] of peerRanges) {
  const candidates = ranges
    .map((range) => semver.minVersion(range)?.version)
    .filter(Boolean)
    .sort(semver.compare);
  const version =
    peerProfile === 'minimum'
      ? candidates.find((candidate) =>
          ranges.every((range) => semver.satisfies(candidate, range)),
        )
      : json(join(root, 'node_modules', peer, 'package.json')).version;
  if (!version || !ranges.every((range) => semver.satisfies(version, range))) {
    throw new Error(
      `No ${peerProfile} peer version for ${peer}: ${ranges.join(', ')}`,
    );
  }
  dependencies[peer] = version;
}
// Compile Angular partial declarations and check React's public type dependency.
for (const name of [
  '@angular/compiler',
  '@types/react',
  '@types/luxon',
  'typescript',
]) {
  dependencies[name] = json(
    join(root, 'node_modules', name, 'package.json'),
  ).version;
}
// Angular requires the compiler and core to have the same version.
dependencies['@angular/compiler'] = dependencies['@angular/core'];
if (peerProfile === 'minimum') dependencies['@types/react'] = '18';
console.log(`Peer profile: ${peerProfile}`);
writeJson(join(consumer, 'package.json'), {
  private: true,
  type: 'module',
  dependencies,
});
run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund']);
writeFileSync(
  join(consumer, 'consumer.cjs'),
  "require('@angular/compiler');\n" +
    names.map((name) => `require('${name}');`).join('\n'),
);
run(process.execPath, ['consumer.cjs']);
console.log(`CommonJS imports passed for ${names.length} packages.`);
writeJson(join(consumer, 'packages.json'), names);
writeFileSync(
  join(consumer, 'contracts.mjs'),
  readFileSync(join(root, 'tools/testing/package-contracts.mjs')),
);
for (const TZ of ['UTC', 'Europe/Warsaw']) {
  console.log(
    run(process.execPath, ['contracts.mjs'], consumer, {
      ...process.env,
      TZ,
    }).trim(),
  );
}
writeFileSync(
  join(consumer, 'consumer.ts'),
  names
    .map(
      (name, i) => `import * as library${i} from '${name}';\nvoid library${i};`,
    )
    .join('\n') +
    readFileSync(join(root, 'tools/testing/consumer-types.ts'), 'utf8'),
);
for (const [module, moduleResolution] of [
  ['ESNext', 'bundler'],
  ['NodeNext', 'NodeNext'],
]) {
  writeJson(join(consumer, 'tsconfig.json'), {
    compilerOptions: {
      strict: true,
      noEmit: true,
      target: 'ES2022',
      module,
      moduleResolution,
      skipLibCheck: false,
    },
    files: ['consumer.ts'],
  });
  run(process.execPath, [
    join(consumer, 'node_modules/typescript/bin/tsc'),
    '-p',
    'tsconfig.json',
  ]);
  console.log(`Strict ${moduleResolution} consumer types passed.`);
}
writeFileSync(
  join(consumer, 'consumer.cts'),
  names
    .map(
      (name, i) =>
        `import library${i} = require('${name}');\nvoid library${i};`,
    )
    .join('\n') +
    readFileSync(join(root, 'tools/testing/consumer-types.ts'), 'utf8'),
);
writeJson(join(consumer, 'tsconfig.json'), {
  compilerOptions: {
    strict: true,
    noEmit: true,
    target: 'ES2022',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    skipLibCheck: false,
  },
  files: ['consumer.cts'],
});
run(process.execPath, [
  join(consumer, 'node_modules/typescript/bin/tsc'),
  '-p',
  'tsconfig.json',
]);
console.log('Strict CommonJS consumer types passed.');
console.log(
  `Package imports, runtime contracts, and consumer types passed for ${names.length} packages.`,
);
