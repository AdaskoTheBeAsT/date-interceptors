import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
let failed = false;
for (const library of readdirSync(join(root, 'libs'))) {
  const config = join(root, 'libs', library, 'tsconfig.spec.json');
  if (!existsSync(config)) continue;
  const result = spawnSync(
    process.execPath,
    [
      join(root, 'node_modules/typescript/bin/tsc'),
      '-p',
      config,
      '--noEmit',
      '--pretty',
      'false',
    ],
    { cwd: root, stdio: 'inherit' },
  );
  failed ||= result.status !== 0;
  console.log(
    `${library}: typecheck ${result.status === 0 ? 'passed' : 'failed'}`,
  );
}
process.exitCode = failed ? 1 : 0;
