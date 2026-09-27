import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const metrics = ['statements', 'branches', 'functions', 'lines'];
const totals = Object.fromEntries(
  metrics.map((key) => [key, { covered: 0, total: 0 }]),
);
const percent = ({ covered, total }) =>
  total === 0 ? '100.00%' : `${((100 * covered) / total).toFixed(2)}%`;

console.log('| Library | Statements | Branches | Functions | Lines |');
console.log('| --- | ---: | ---: | ---: | ---: |');
for (const entry of readdirSync(new URL('libs/', root), {
  withFileTypes: true,
}).sort((a, b) => a.name.localeCompare(b.name))) {
  if (!entry.isDirectory()) continue;
  const report = new URL(
    `.reports/libs/${entry.name}/coverage/coverage-summary.json`,
    root,
  );
  let coverage;
  try {
    coverage = JSON.parse(readFileSync(report, 'utf8')).total;
  } catch (cause) {
    throw new Error(
      `Missing or invalid coverage report: ${fileURLToPath(report)}. Run yarn test:all first.`,
      { cause },
    );
  }
  for (const key of metrics) {
    totals[key].covered += coverage[key].covered;
    totals[key].total += coverage[key].total;
  }
  console.log(
    `| ${entry.name} | ${metrics.map((key) => percent(coverage[key])).join(' | ')} |`,
  );
}
console.log(
  `| **Total** | ${metrics.map((key) => `**${percent(totals[key])}**`).join(' | ')} |`,
);
