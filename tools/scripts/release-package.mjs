import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const registry = 'https://registry.npmjs.org';

export async function releasePackage(
  directory,
  { npm = runNpm, request = fetch, sleep = setTimeout } = {},
) {
  const manifest = JSON.parse(
    readFileSync(join(directory, 'package.json'), 'utf8'),
  );
  const url = `${registry}/${encodeURIComponent(manifest.name)}/${manifest.version}`;
  const lookup = async () => {
    const response = await request(url, {
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status === 404) return undefined;
    if (!response.ok)
      throw new Error(`Registry lookup failed: HTTP ${response.status}`);
    return response.json();
  };
  const [packed] = JSON.parse(
    npm(['pack', '--dry-run', '--json', '--ignore-scripts'], directory),
  );
  const verify = (published) => {
    if (published.dist?.integrity !== packed.integrity)
      throw new Error(
        `${manifest.name}@${manifest.version} already exists with different contents`,
      );
  };
  const existing = await lookup();
  if (existing) {
    verify(existing);
    console.log(`Already published: ${manifest.name}@${manifest.version}`);
    return;
  }
  npm(
    [
      'publish',
      '--access',
      'public',
      '--provenance',
      '--ignore-scripts',
      '--registry',
      registry,
      '--tag',
      manifest.version.includes('-') ? 'next' : 'latest',
    ],
    directory,
  );
  // Gate dependent jobs on registry visibility, not just a successful upload.
  for (let attempt = 0; attempt < 30; attempt++) {
    const published = await lookup();
    if (published) {
      verify(published);
      console.log(`Verified publication: ${manifest.name}@${manifest.version}`);
      return;
    }
    await sleep(10_000);
  }
  throw new Error(
    `Publication not yet visible: ${manifest.name}@${manifest.version}. Retry the workflow later.`,
  );
}

function runNpm(args, cwd) {
  const windows = process.platform === 'win32';
  const result = spawnSync(
    windows ? process.execPath : 'npm',
    windows
      ? [
          join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
          ...args,
        ]
      : args,
    { cwd, encoding: 'utf8', timeout: 120_000 },
  );
  if (result.status !== 0)
    throw new Error(`npm ${args[0]} failed (exit ${result.status})`);
  return result.stdout;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (!process.argv[2]) throw new Error('Pass the built package directory');
  await releasePackage(resolve(process.argv[2]));
}
