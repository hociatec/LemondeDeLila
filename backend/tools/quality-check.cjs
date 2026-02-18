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
const regressions = Object.entries(report.regressions || {}).filter(
  ([, value]) => Boolean(value),
);

if (regressions.length > 0) {
  console.error('quality-check: regression detected');
  for (const [name] of regressions) {
    const current = report.metrics?.[name];
    const baseline = report.baseline?.[name];
    console.error(`- ${name}: ${current} (baseline ${baseline})`);
  }
  process.exit(2);
}

console.log('quality-check: OK (no regression vs baseline)');
