import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { test } from 'node:test';

import { releasePackage } from './release-package.mjs';

function fixture(t, statuses, version = '11.0.0') {
  const directory = mkdtempSync(join(tmpdir(), 'release-package-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(
    join(directory, 'package.json'),
    JSON.stringify({ name: '@test/core', version }),
  );
  const calls = [];
  let index = 0;
  return {
    directory,
    calls,
    options: {
      npm(args) {
        calls.push(args);
        return JSON.stringify([{ integrity: 'sha512-same' }]);
      },
      async request() {
        const status = statuses[Math.min(index++, statuses.length - 1)];
        return {
          status,
          ok: status === 200,
          async json() {
            return { dist: { integrity: 'sha512-same' } };
          },
        };
      },
      async sleep() {},
    },
  };
}

test('skips an identical published artifact', async (t) => {
  const { directory, options, calls } = fixture(t, [200]);
  await releasePackage(directory, options);
  assert.equal(calls.length, 1);
});

test('publishes a missing release and waits for visibility', async (t) => {
  const { directory, options, calls } = fixture(t, [404, 404, 200]);
  await releasePackage(directory, options);
  assert.equal(calls[1][0], 'publish');
  assert.equal(calls[1].at(-1), 'latest');
});

test('prereleases use next rather than latest', async (t) => {
  const { directory, options, calls } = fixture(t, [404, 200], '11.0.0-rc.1');
  await releasePackage(directory, options);
  assert.equal(calls[1].at(-1), 'next');
});

test('registry failures never trigger publication', async (t) => {
  const { directory, options, calls } = fixture(t, [503]);
  await assert.rejects(releasePackage(directory, options), /HTTP 503/);
  assert.equal(calls.length, 1);
});

test('rejects conflicting published contents', async (t) => {
  const { directory, options } = fixture(t, [200]);
  options.npm = () => JSON.stringify([{ integrity: 'sha512-different' }]);
  await assert.rejects(
    releasePackage(directory, options),
    /different contents/,
  );
});

test('fails if propagation never completes', async (t) => {
  const { directory, options } = fixture(t, [404]);
  await assert.rejects(releasePackage(directory, options), /not yet visible/);
});
