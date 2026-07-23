#!/usr/bin/env node
/* eslint-disable no-console */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function rgCount(pattern, searchRoot, extraArgs = []) {
  const result = spawnSync(
    'rg',
    ['-n', pattern, searchRoot, '-g', '*.ts', ...extraArgs],
    { encoding: 'utf8' },
  );
  // In this environment, spawnSync can set result.error (EPERM) even when the
  // command actually executed and produced stdout. Use stdout when available.
  if (result.error && !result.stdout) return 0;
  // ripgrep returns:
  // - 0 when matches are found
  // - 1 when no matches are found
  // Treat other non-zero statuses as failures unless stdout exists.
  if (result.status != null && result.status !== 0 && result.status !== 1 && !result.stdout) {
    return 0;
  }
  const lines = String(result.stdout ?? '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  return lines.length;
}

function readBaseline() {
  const file = path.resolve(__dirname, 'quality-baseline.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function getBaselineMetric(baseline, key, fallbackCurrent) {
  const raw = baseline?.metrics?.[key];
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : fallbackCurrent;
}

const manualActionPayloadParsing = rgCount(
  'Number\\(\\(action\\.payload|String\\(\\(action\\.payload',
  'src/game',
);
const productionDirectPendingAssignments = rgCount(
  'pending\\s*:\\s*\\{',
  'src/game',
  ['-g', '!*.spec.ts'],
);
const mojibakeMatches = rgCount('Ã|â€™|â€œ|â€|Â|ï»¿|�', 'src');
const scoresByPlayerIdMentionsInGames = rgCount(
  '\\bscoresByPlayerId\\b',
  'src/game/games',
);
const targetScoreMentionsInGames = rgCount(
  '\\btargetScore\\b|\\btargetPoints\\b',
  'src/game/games',
);

const baseline = readBaseline();
const baselineManualActionPayloadParsing = getBaselineMetric(
  baseline,
  'manualActionPayloadParsing',
  manualActionPayloadParsing,
);
const baselineDirectPendingAssignments = getBaselineMetric(
  baseline,
  'directPendingAssignments',
  productionDirectPendingAssignments,
);
const baselineMojibakeMatches = getBaselineMetric(
  baseline,
  'mojibakeMatches',
  mojibakeMatches,
);
const baselineScoresByPlayerIdMentionsInGames = getBaselineMetric(
  baseline,
  'scoresByPlayerIdMentionsInGames',
  scoresByPlayerIdMentionsInGames,
);
const baselineTargetScoreMentionsInGames = getBaselineMetric(
  baseline,
  'targetScoreMentionsInGames',
  targetScoreMentionsInGames,
);
const report = {
  generatedAt: new Date().toISOString(),
  baselineUpdatedAt: baseline.updatedAt,
  metrics: {
    manualActionPayloadParsing,
    directPendingAssignments: productionDirectPendingAssignments,
    mojibakeMatches,
    scoresByPlayerIdMentionsInGames,
    targetScoreMentionsInGames,
  },
  baseline: baseline.metrics,
  regressions: {
    manualActionPayloadParsing:
      manualActionPayloadParsing > baselineManualActionPayloadParsing,
    directPendingAssignments:
      productionDirectPendingAssignments > baselineDirectPendingAssignments,
    mojibakeMatches: mojibakeMatches > baselineMojibakeMatches,
    scoresByPlayerIdMentionsInGames:
      scoresByPlayerIdMentionsInGames >
      baselineScoresByPlayerIdMentionsInGames,
    targetScoreMentionsInGames:
      targetScoreMentionsInGames > baselineTargetScoreMentionsInGames,
  },
};

const outFile = path.resolve(__dirname, 'quality-report.json');
fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`quality-report: ${path.relative(process.cwd(), outFile)}`);
console.log(JSON.stringify(report.metrics));
