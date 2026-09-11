#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sourceRoot = path.join(root, 'src');
const violations = [];

// Completed architecture migrations must not regain grandfathered violations.
for (const [file, field] of [
  ['architecture-baseline.json', 'groups'],
  ['structural-quality-baseline.json', 'violations'],
]) {
  const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  if (!Array.isArray(baseline[field]) || baseline[field].length !== 0)
    violations.push(`${file}: temporary architecture exceptions are forbidden`);
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

const files = walk(sourceRoot).filter(
  (file) =>
    file.endsWith('.ts') &&
    !file.endsWith('.spec.ts') &&
    !file.endsWith('.test.ts') &&
    !file.includes(`${path.sep}migrations${path.sep}`),
);

for (const file of files) {
  const relative = path.relative(root, file).split(path.sep).join('/');
  const source = fs.readFileSync(file, 'utf8');
  if (/@deprecated\b/.test(source)) violations.push(`${relative}: deprecated API`);
  if (/\bFeatureFlag\b|featureFlag|feature-flag/i.test(source)) {
    violations.push(`${relative}: feature flag applicatif non stabilisé`);
  }
  if (/\b(?:Legacy|Compat(?:ibility)?)(?:Adapter|Api|Service)\b/i.test(source)) {
    violations.push(`${relative}: adaptateur/API de compatibilité applicatif`);
  }
}

if (violations.length > 0) {
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log(`architecture-debt-final-check: ${files.length} fichiers applicatifs contrôlés, invariants OK`);
}
