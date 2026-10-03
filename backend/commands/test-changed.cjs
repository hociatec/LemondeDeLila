'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { planImpact } = require('../tools/changed-impact.cjs');

const backendRoot = path.resolve(__dirname, '..');
const repositoryRoot = path.resolve(backendRoot, '..');
const passthrough = process.argv.slice(2).filter((value) => value !== '--');
const value = (name) => {
  const prefix = `--${name}=`;
  return passthrough.find((item) => item.startsWith(prefix))?.slice(prefix.length);
};
const base = value('base') ?? process.env.CHANGED_BASE;
const head = value('head') ?? process.env.CHANGED_HEAD;
const explicit = value('files');
const scope = value('scope') ?? 'all';

function gitFiles() {
  if (explicit) return explicit.split(',').filter(Boolean);
  const args = ['diff', '--name-only', '--diff-filter=ACMR'];
  if (base) args.push(head ? `${base}...${head}` : base);
  else args.push('HEAD');
  const tracked = spawnSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  if (tracked.status !== 0) process.exit(tracked.status ?? 1);
  const files = tracked.stdout.trim().split(/\r?\n/).filter(Boolean);
  if (!base) {
    const untracked = spawnSync(
      'git',
      ['ls-files', '--others', '--exclude-standard'],
      { cwd: repositoryRoot, encoding: 'utf8' },
    );
    files.push(...untracked.stdout.trim().split(/\r?\n/).filter(Boolean));
  }
  return files;
}

function run(command, args, environment = {}) {
  const result = spawnSync(command, args, {
    cwd: backendRoot,
    stdio: 'inherit',
    env: { ...process.env, GAME_TEST_PROFILE: 'fast', ...environment },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function runJest(args, environment = {}) {
  run(process.execPath, [require.resolve('jest/bin/jest'), ...args], environment);
}

const files = gitFiles();
const plan = planImpact(files);
process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
if (!plan.backend) process.exit(0);

const sourceFiles = files
  .filter((file) => /^backend\/src\/.*\.(?:ts|js)$/.test(file))
  .map((file) => path.join(repositoryRoot, file))
  .filter((file) => fs.existsSync(file));
if (scope !== 'games' && sourceFiles.length)
  runJest([
    '--maxWorkers=4',
    '--passWithNoTests',
    '--testPathIgnorePatterns=game/games|game/testing/architecture-tests/game',
    '--findRelatedTests',
    ...sourceFiles,
  ]);

if (scope === 'all' && plan.architecture)
  run(process.execPath, ['--test', 'tools/changed-impact.spec.cjs']);

const gameSpecs = plan.games.flatMap((id) => {
  const root = path.join(backendRoot, 'src/game/games');
  return fs
    .readdirSync(root, { recursive: true })
    .filter((entry) => typeof entry === 'string' && entry.includes(`/${id}/`))
    .filter((entry) => entry.endsWith('.spec.ts'))
    .map((entry) => path.join(root, entry));
});
if (scope !== 'unit' && gameSpecs.length)
  runJest(['--maxWorkers=4', ...gameSpecs]);

if (scope !== 'unit' && (plan.allGames || plan.games.length)) {
  const selected = plan.allGames ? '' : plan.games.join(',');
  runJest(
    [
      '--runInBand',
      'game/testing/architecture-tests/game/all-declarative-games.contract.spec.ts',
      'game/testing/architecture-tests/game/reference-replays.spec.ts',
    ],
    { GAME_TEST_GAME_IDS: selected },
  );
}
