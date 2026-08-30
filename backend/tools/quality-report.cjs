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
  if (
    result.status != null &&
    result.status !== 0 &&
    result.status !== 1 &&
    !result.stdout
  ) {
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

function getLimit(baseline, key, fallbackCurrent) {
  const raw = baseline?.limits?.[key];
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
const mojibakeMatches = rgCount(
  'Ã|â€™|â€œ|â€|â‚|Ì€|ï»¿|�|\\x{FEFF}|[\\x80-\\x9F]|[A-Za-zÀ-ÿ]\\?[A-Za-zÀ-ÿ]',
  'src',
  ['-g', '!*.spec.ts'],
);
const scoresByPlayerIdMentionsInGames = rgCount(
  '\\bscoresByPlayerId\\b',
  'src/game/games',
);
const targetScoreMentionsInGames = rgCount(
  '\\btargetScore\\b|\\btargetPoints\\b',
  'src/game/games',
);

const baseline = readBaseline();
const manualActionPayloadParsingLimit = getLimit(
  baseline,
  'manualActionPayloadParsing',
  manualActionPayloadParsing,
);
const mojibakeMatchesLimit = getLimit(
  baseline,
  'mojibakeMatches',
  mojibakeMatches,
);
const report = {
  contractVersion: baseline.contractVersion ?? 2,
  generatedAt: new Date().toISOString(),
  contractUpdatedAt: baseline.updatedAt,
  metrics: {
    manualActionPayloadParsing,
    mojibakeMatches,
  },
  observations: {
    directPendingAssignments: productionDirectPendingAssignments,
    scoresByPlayerIdMentionsInGames,
    targetScoreMentionsInGames,
  },
  limits: baseline.limits,
  violations: {
    manualActionPayloadParsing:
      manualActionPayloadParsing > manualActionPayloadParsingLimit,
    mojibakeMatches: mojibakeMatches > mojibakeMatchesLimit,
  },
};

const outFile = path.resolve(__dirname, 'quality-report.json');
fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`quality-report: ${path.relative(process.cwd(), outFile)}`);
console.log(JSON.stringify(report.metrics));
