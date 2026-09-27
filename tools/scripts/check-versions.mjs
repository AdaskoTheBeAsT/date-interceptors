// Verifies that every library manifest carries the same version and that every
// internal @adaskothebeast/* range accepts exactly that release line.
// Usage: node tools/scripts/check-versions.mjs [expected-version-or-tag]
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const nxJson = JSON.parse(readFileSync(join(root, 'nx.json'), 'utf8'));
const releaseProjects = new Set(nxJson.release?.projects ?? []);
const libraries = readdirSync(join(root, 'libs'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => existsSync(join(root, 'libs', name, 'package.json')));

const errors = [];
const manifests = libraries.map((library) => ({
  library,
  manifest: JSON.parse(
    readFileSync(join(root, 'libs', library, 'package.json'), 'utf8'),
  ),
}));

for (const library of libraries) {
  if (!releaseProjects.has(library)) {
    errors.push(`libs/${library} is not listed in nx.json release.projects`);
  }
}
for (const project of releaseProjects) {
  if (!libraries.includes(project)) {
    errors.push(`nx.json release.projects lists unknown library "${project}"`);
  }
}

const argument = process.argv[2]?.trim();
const expected = argument
  ? argument.replace(/^refs\/tags\//, '').replace(/^v/, '')
  : manifests[0]?.manifest.version;
const versions = new Map();
for (const { library, manifest } of manifests) {
  const list = versions.get(manifest.version) ?? [];
  list.push(library);
  versions.set(manifest.version, list);
}
if (versions.size > 1) {
  errors.push(
    `Library versions differ:\n${[...versions]
      .map(([version, list]) => `  ${version}: ${list.join(', ')}`)
      .join('\n')}`,
  );
}
if (
  !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(expected)
) {
  errors.push(`"${expected}" is not a valid semantic version`);
}
for (const { library, manifest } of manifests) {
  if (manifest.version !== expected) {
    errors.push(
      `libs/${library}: version ${manifest.version} does not match ${expected}`,
    );
  }
}

const internalNames = new Set(manifests.map(({ manifest }) => manifest.name));
const expectedRange = `^${expected}`;
for (const { library, manifest } of manifests) {
  for (const field of [
    'dependencies',
    'peerDependencies',
    'optionalDependencies',
    'devDependencies',
  ]) {
    for (const [name, range] of Object.entries(manifest[field] ?? {})) {
      if (name.startsWith('@adaskothebeast/') && !internalNames.has(name)) {
        errors.push(`libs/${library}: ${field} references unknown ${name}`);
      } else if (internalNames.has(name) && range !== expectedRange) {
        errors.push(
          `libs/${library}: ${field}.${name} is "${range}", expected "${expectedRange}"`,
        );
      }
    }
  }
}

if (errors.length) {
  console.error(`Version check failed:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(
  `All ${manifests.length} libraries are at ${expected} with ${expectedRange} internal ranges.`,
);
