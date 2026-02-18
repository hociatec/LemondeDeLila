#!/usr/bin/env node
/* eslint-disable no-console */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function rgCount(pattern, searchRoot) {
  const result = spawnSync(
    'rg',
    ['-n', pattern, searchRoot, '-g', '*.ts'],
    { encoding: 'utf8' },
  );
  if (result.error) return 0;
  if (result.status !== 0 && !result.stdout) return 0;
  const lines = String(result.stdout ?? '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  return lines.length;
}

function readBaseline() {
  const file = path.resolve(__dirname, 'quality-baseline.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const manualActionPayloadParsing = rgCount(
  'Number\\(\\(action\\.payload|String\\(\\(action\\.payload',
  'src/game',
);
const directPendingAssignments = rgCount('pending\\s*:\\s*\\{', 'src/game');
const mojibakeMatches = rgCount('Ã|â€™|â€œ|â€|Â|ï»¿|�', 'src');

const baseline = readBaseline();
const report = {
  generatedAt: new Date().toISOString(),
  baselineUpdatedAt: baseline.updatedAt,
  metrics: {
    manualActionPayloadParsing,
    directPendingAssignments,
    mojibakeMatches,
  },
  baseline: baseline.metrics,
  regressions: {
    manualActionPayloadParsing:
      manualActionPayloadParsing > baseline.metrics.manualActionPayloadParsing,
    directPendingAssignments:
      directPendingAssignments > baseline.metrics.directPendingAssignments,
    mojibakeMatches: mojibakeMatches > baseline.metrics.mojibakeMatches,
  },
};

const outFile = path.resolve(__dirname, 'quality-report.json');
fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`quality-report: ${path.relative(process.cwd(), outFile)}`);
console.log(JSON.stringify(report.metrics));
