'use strict';

const { spawnSync } = require('node:child_process');

const input = process.argv.slice(2).filter((argument) => argument !== '--');
const exhaustive = input.includes('--exhaustive');
const args = input.filter((argument) => argument !== '--exhaustive');
const hasWorkerOption = args.some(
  (argument) =>
    argument === '--runInBand' ||
    argument === '-i' ||
    argument.startsWith('--maxWorkers'),
);
const exhaustiveSuites = [
  'all-games.scenario-coverage.spec.ts',
  'reference-replays.spec.ts',
];
const fastExcludedSuites = [
  ...exhaustiveSuites,
  'game/testing/architecture-tests/',
  'game/games/.+\\.spec\\.ts',
];
const targetsTestSuite = args.some(
  (argument) => argument.includes('.spec.') || argument.includes('.test.'),
);

if (!exhaustive && !targetsTestSuite)
  args.push(`--testPathIgnorePatterns=${fastExcludedSuites.join('|')}`);

if (!hasWorkerOption) args.unshift('--maxWorkers=4');

const result = spawnSync(require.resolve('jest/bin/jest'), args, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    GAME_TEST_PROFILE: exhaustive ? 'exhaustive' : 'fast',
  },
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
