#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const reportFile = path.resolve(__dirname, 'quality-report.json');
if (!fs.existsSync(reportFile)) {
  console.error('quality-check: missing quality-report.json, run quality:report first');
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
const violations = Object.entries(report.violations || {}).filter(
  ([, value]) => Boolean(value),
);

if (violations.length > 0) {
  console.error('quality-check: violation detected');
  for (const [name] of violations) {
    const current = report.metrics?.[name];
    const limit = report.limits?.[name];
    console.error(`- ${name}: ${current} (limit ${limit})`);
  }
  process.exit(2);
}

console.log('quality-check: OK (0 violations)');
for (const [name, value] of Object.entries(report.observations || {})) {
  console.log(`- observation ${name}: ${value}`);
}
