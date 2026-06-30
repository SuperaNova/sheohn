import fs from 'fs';
import path from 'path';

// Allow `--dir <path>` to summarize an alternate output dir (e.g. mobile runs).
const dirFlagIndex = process.argv.indexOf('--dir');
const outputDir =
  dirFlagIndex !== -1 && process.argv[dirFlagIndex + 1]
    ? process.argv[dirFlagIndex + 1]
    : '.lighthouseci';

const manifestPath = path.join(outputDir, 'manifest.json');

if (!fs.existsSync(manifestPath)) {
  console.error(
    '\n[Lighthouse Summary] No manifest.json found. Did lhci autorun complete?',
  );
  process.exit(0);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

console.log(
  '\n===================================================================',
);
console.log(
  '                   LIGHTHOUSE AUDIT SUMMARY                        ',
);
console.log(
  '===================================================================',
);

// With numberOfRuns > 1 each URL appears multiple times; only the median
// ("representative") run is meaningful, so skip the rest to keep output clean.
manifest
  .filter((run) => run.isRepresentativeRun)
  .forEach((run) => {
    // LHCI manifest maps each run to its corresponding JSON report
    const jsonPath = path.join(outputDir, path.basename(run.jsonPath));

    if (!fs.existsSync(jsonPath)) return;

    const lhr = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const categories = lhr.categories;

    // Format scores out of 100
    const formatScore = (cat) => {
      if (!cat || cat.score === null) return 'N/A';
      const score = Math.round(cat.score * 100);
      // Green if >= 90, Yellow if >= 50, Red otherwise
      const color =
        score >= 90 ? '\x1b[32m' : score >= 50 ? '\x1b[33m' : '\x1b[31m';
      return `${color}${score.toString().padEnd(3)}\x1b[0m`;
    };

    const url = new URL(run.url);
    // Get the path and query string without the localhost domain
    const route = url.pathname + url.search;

    console.log(`\n-- ${route} --`);
    console.log(`   Performance:    ${formatScore(categories.performance)}`);
    console.log(`   Accessibility:  ${formatScore(categories.accessibility)}`);
    console.log(
      `   Best Practices: ${formatScore(categories['best-practices'])}`,
    );
    console.log(`   SEO:            ${formatScore(categories.seo)}`);
  });

console.log(
  '\n===================================================================\n',
);
