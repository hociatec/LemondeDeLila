'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const repositoryRoot = path.resolve(__dirname, '../..');
const backendRoot = path.join(repositoryRoot, 'backend');
const gamePath = /^backend\/src\/game\/games\/[^/]+\/([^/]+)\//;
const extensionPath =
  /^backend\/src\/game\/rules\/game-specific\/([^/]+)\//;
const mechanicsByPath = [
  [/(card|deck|hand|draw|discard)/, ['cards', 'zones', 'collections']],
  [/(choice|vot|submission)/, ['choices']],
  [/(movement|pawn|track|position)/, ['movement']],
  [/(resource|payment|score)/, ['resources', 'payment', 'scoring']],
  [/(status|modifier)/, ['status']],
  [/(victory|finish|winner)/, ['victory']],
  [/(target|player-selector)/, ['targeting']],
  [/(trigger|event|automatic)/, ['triggers']],
];

function normalize(file) {
  return file.replaceAll('\\', '/').replace(/^\.\//, '');
}

function gameMatrix() {
  const file = path.join(backendRoot, 'docs/quality/game-mechanics-matrix.json');
  if (!fs.existsSync(file)) return { games: [], extensions: [] };
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function consumersForPrimitive(file, matrix) {
  const mechanics = mechanicsByPath.find(([pattern]) => pattern.test(file))?.[1];
  if (!mechanics) return [];
  return matrix.games
    .filter((game) =>
      mechanics.some((mechanic) => (game.mechanics?.[mechanic] ?? []).length > 0),
    )
    .map((game) => game.id);
}

function planImpact(inputFiles, matrix = gameMatrix()) {
  const files = [...new Set(inputFiles.map(normalize).filter(Boolean))].sort();
  const games = new Set();
  const reasons = new Set();
  let backend = false;
  let client = false;
  let architecture = false;
  let integration = false;
  let release = false;
  let allGames = false;

  for (const file of files) {
    if (file.startsWith('client-wx/')) client = true;
    if (
      file.startsWith('backend/') ||
      file === '.github/workflows/backend-architecture.yml' ||
      file === '.github/workflows/backend-nightly.yml'
    )
      backend = true;
    if (/^backend\/(package(?:-lock)?\.json|tsconfig.*\.json)$/.test(file)) {
      architecture = integration = release = allGames = true;
      reasons.add('backend toolchain changed');
    }
    if (file.startsWith('backend/tools/') || file.startsWith('backend/commands/')) {
      architecture = true;
      reasons.add('certification tooling changed');
    }
    if (file.startsWith('backend/src/platform/database/migrations/')) {
      integration = release = true;
      reasons.add('database migration changed');
    }
    if (
      file.startsWith('backend/src/platform/') ||
      file.startsWith('backend/src/modules/')
    )
      integration = true;
    if (file.startsWith('backend/src/') && !file.endsWith('.spec.ts')) release = true;

    const directGame = file.match(gamePath)?.[1];
    if (directGame) {
      games.add(directGame);
      reasons.add(`game changed: ${directGame}`);
      continue;
    }
    const extension = file.match(extensionPath)?.[1];
    if (extension) {
      const consumers = matrix.extensions?.find(
        (candidate) => candidate.name === extension,
      )?.consumers;
      if (consumers?.length) {
        consumers.forEach((game) => games.add(game));
        reasons.add(`extension consumers changed: ${extension}`);
      } else {
        allGames = true;
        reasons.add(`unmapped extension changed: ${extension}`);
      }
      continue;
    }
    if (file.startsWith('backend/src/game/engine/runtime/')) {
      const consumers = consumersForPrimitive(file, matrix);
      if (consumers.length) {
        consumers.forEach((game) => games.add(game));
        reasons.add('generic primitive consumers changed');
      } else {
        allGames = true;
        reasons.add('game runtime core changed');
      }
    } else if (
      file.startsWith('backend/src/game/composition/') ||
      file.startsWith('backend/src/game/core/') ||
      file.startsWith('backend/src/game/rules/public-api')
    ) {
      allGames = true;
      reasons.add('game core changed');
    }
  }

  return {
    files,
    backend,
    client,
    architecture,
    integration,
    release,
    allGames,
    games: allGames ? [] : [...games].sort(),
    reasons: [...reasons].sort(),
  };
}

function changedFiles(base, head) {
  if (base) {
    const range = head ? `${base}...${head}` : base;
    return execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMR', range], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    }).trim().split(/\r?\n/).filter(Boolean);
  }
  const tracked = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMR', 'HEAD'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).trim().split(/\r?\n/).filter(Boolean);
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).trim().split(/\r?\n/).filter(Boolean);
  return [...tracked, ...untracked];
}

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function writeGithubOutputs(plan, outputFile) {
  const values = {
    backend: plan.backend,
    client: plan.client,
    architecture: plan.architecture,
    integration: plan.integration,
    release: plan.release,
    all_games: plan.allGames,
    game_ids: plan.games.join(','),
    has_games: plan.allGames || plan.games.length > 0,
  };
  fs.appendFileSync(
    outputFile,
    Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join(''),
  );
}

if (require.main === module) {
  const explicit = argument('files');
  const plan = planImpact(
    explicit ? explicit.split(',') : changedFiles(argument('base'), argument('head')),
  );
  if (process.env.GITHUB_OUTPUT) writeGithubOutputs(plan, process.env.GITHUB_OUTPUT);
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
}

module.exports = { consumersForPrimitive, planImpact };
