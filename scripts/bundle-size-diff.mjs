import fs from 'fs';

// Formats a Markdown byte-diff table from two `size-limit --json` outputs —
// one measured on the PR branch, one measured on `main` — for
// `.github/workflows/bundle-size.yml` to post as a PR comment.
//
// Usage: node scripts/bundle-size-diff.mjs <pr-size.json> <base-size.json>
//
// Tolerant of a missing/unparsable base file (e.g. the very first PR that
// introduces size-limit itself, where `main` has no `.size-limit.js` yet) —
// every row is then reported as "new" rather than failing the script.

const [, , prPath, basePath] = process.argv;

function readSizes(path) {
  if (!path) return [];
  try {
    const raw = fs.readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const prSizes = readSizes(prPath);
const baseSizes = readSizes(basePath);
const baseByName = new Map(baseSizes.map((entry) => [entry.name, entry]));

if (prSizes.length === 0) {
  console.log('### Bundle size (size-limit)\n');
  console.log(
    '_No size-limit results were produced for this PR — see the workflow logs._',
  );
  process.exit(0);
}

const rows = prSizes.map((entry) => {
  const base = baseByName.get(entry.name);
  let diffCell = 'new';
  if (base) {
    const diff = entry.size - base.size;
    const sign = diff > 0 ? '+' : '';
    diffCell = `${sign}${diff.toLocaleString()} B`;
  }
  const status = entry.passed ? '✅' : '❌ OVER BUDGET';
  return `| \`${entry.name}\` | ${entry.size.toLocaleString()} B | ${entry.sizeLimit.toLocaleString()} B | ${diffCell} | ${status} |`;
});

const anyFailed = prSizes.some((entry) => !entry.passed);

console.log('### Bundle size (size-limit)\n');
console.log(
  'Gzip size of each budgeted client JS chunk vs. its configured limit, and the byte diff against `main`.\n',
);
console.log('| Chunk | Size (gzip) | Budget | vs `main` | Status |');
console.log('| --- | --- | --- | --- | --- |');
console.log(rows.join('\n'));
if (anyFailed) {
  console.log(
    '\n⚠️ One or more chunks exceeded their configured budget — see `.size-limit.js` to review or (deliberately) raise the limit.',
  );
}
