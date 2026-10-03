'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const logs = path.join(root, 'logs');
const raw = path.join(logs, 'jest-profile.raw.json');
const reportFile = path.join(logs, 'slow-test-suites.json');
fs.mkdirSync(logs, { recursive: true });

const result = spawnSync(
  require.resolve('jest/bin/jest'),
  [
    '--maxWorkers=4',
    '--json',
    `--outputFile=${raw}`,
    ...process.argv.slice(2).filter((argument) => argument !== '--'),
  ],
  { cwd: root, stdio: 'inherit', env: { ...process.env, GAME_TEST_PROFILE: 'exhaustive' } },
);
if (result.error) throw result.error;
if (!fs.existsSync(raw)) process.exit(result.status ?? 1);

const payload = JSON.parse(fs.readFileSync(raw, 'utf8'));
const suites = (payload.testResults ?? [])
  .map((suite) => ({
    file: path.relative(root, suite.name).replaceAll('\\', '/'),
    milliseconds: Math.max(0, suite.endTime - suite.startTime),
    tests: suite.assertionResults?.length ?? 0,
  }))
  .sort((left, right) => right.milliseconds - left.milliseconds)
  .slice(0, 20);
const report = {
  generatedAt: new Date().toISOString(),
  totalSuites: payload.numTotalTestSuites,
  totalTests: payload.numTotalTests,
  slowestSuites: suites,
};
fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exitCode = result.status ?? 1;
