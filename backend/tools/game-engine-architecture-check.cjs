#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const repoRoot = path.resolve(__dirname, '..');
const defaultGamesRoot = path.join(repoRoot, 'src', 'game', 'games');
const defaultGameRoot = path.join(repoRoot, 'src', 'game');
const defaultRuntimeRoot = path.join(
  repoRoot,
  'src',
  'game',
  'core',
  'application',
  'runtime',
);
const standardFiles = [
  'game.ts',
  'state.ts',
  'rules.ts',
  'content.ts',
  'game.spec.ts',
];
const forbiddenGameLayers = new Set([
  'actions',
  'application',
  'definitions',
  'domain',
  'infrastructure',
  'legacy',
  'deprecated',
  'presenter',
  'registrar',
  'rulebook',
  'services',
  'setup',
  'shortcuts',
  'v1',
]);
const forbiddenLegacySymbols = [
  'GameRulebook',
  'StateMachineService',
  'GamePhaseOrchestratorService',
  'GameRulesAdapter',
  'GameDefinition',
  'ActionService',
  'GameCoreService',
  'TurnFlowService',
  'discoverGameModules',
];
const forbiddenLegacyFilePatterns = [
  /\.runtime\.ts$/,
  /\.shortcuts\.ts$/,
  /\.pawns\.ts$/,
  /\.definition\.ts$/,
];

function normalize(value) {
  return value.split(path.sep).join('/');
}

function walk(root) {
  if (!fs.existsSync(root)) return [];
  const entries = fs.readdirSync(root, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const target = path.join(root, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

function directories(root) {
  if (!fs.existsSync(root)) return [];
  const found = [];
  const visit = (directory) => {
    found.push(directory);
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) visit(path.join(directory, entry.name));
    }
  };
  visit(root);
  return found;
}

function lineCount(source) {
  return source.split(/\r?\n/).length;
}

function add(violations, rule, file, message) {
  violations.push({ rule, file: normalize(file), message });
}

function inspectUnsafeTypes(source, relative, violations) {
  const sourceFile = ts.createSourceFile(
    relative,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const visit = (node) => {
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      add(violations, 'no-any', relative, 'Le type any est interdit.');
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (/\bas\s+unknown\s+as\b/.test(source)) {
    add(
      violations,
      'no-double-cast',
      relative,
      'Les doubles casts via unknown sont interdits.',
    );
  }
  if (/\bmetadata\s+as\b/.test(source)) {
    add(
      violations,
      'typed-engine-state',
      relative,
      'Les casts de metadata sont interdits.',
    );
  }
}

function auditGamePackages(gamesRoot, violations) {
  const manifests = walk(gamesRoot)
    .filter((file) => path.basename(file) === 'manifest.json')
    .sort();
  const ids = new Map();
  for (const manifestFile of manifests) {
    const gameDirectory = path.dirname(manifestFile);
    const relativeDirectory = normalize(path.relative(repoRoot, gameDirectory));
    const manifest = JSON.parse(
      fs.readFileSync(manifestFile, 'utf8').replace(/^\uFEFF/, ''),
    );
    const id = String(manifest.code ?? '').trim();
    if (!id) add(violations, 'manifest-id', relativeDirectory, 'Code absent.');
    if (ids.has(id)) {
      add(
        violations,
        'unique-game-id',
        relativeDirectory,
        `Code dupliqué: ${id}`,
      );
    }
    ids.set(id, relativeDirectory);

    for (const file of standardFiles) {
      if (!fs.existsSync(path.join(gameDirectory, file))) {
        add(
          violations,
          'standard-entry-files',
          relativeDirectory,
          `Fichier obligatoire absent: ${file}`,
        );
      }
    }
    const gameFile = path.join(gameDirectory, 'game.ts');
    if (fs.existsSync(gameFile)) {
      const source = fs.readFileSync(gameFile, 'utf8');
      const definitionStart = source.search(/export\s+default\s+defineGame\b/);
      if (definitionStart < 0) {
        add(
          violations,
          'declarative-default-export',
          normalize(path.relative(repoRoot, gameFile)),
          'game.ts doit exporter defineGame(...) par défaut.',
        );
      }
      const declaredId = source
        .slice(Math.max(0, definitionStart))
        .match(/\bid\s*:\s*['"]([^'"]+)['"]/)?.[1];
      if (declaredId !== id) {
        add(
          violations,
          'manifest-definition-id',
          normalize(path.relative(repoRoot, gameFile)),
          `Id ${declaredId ?? '(absent)'} différent du manifeste ${id}.`,
        );
      }
    }
    const specFile = path.join(gameDirectory, 'game.spec.ts');
    if (
      fs.existsSync(specFile) &&
      !/\btestGame\s*\(/.test(fs.readFileSync(specFile, 'utf8'))
    ) {
      add(
        violations,
        'game-test-kit',
        normalize(path.relative(repoRoot, specFile)),
        'Le test standard doit utiliser GameTestKit via testGame().',
      );
    }
  }

  const gameEntries = walk(gamesRoot).filter(
    (file) => path.basename(file) === 'game.ts',
  );
  if (gameEntries.length !== manifests.length) {
    add(
      violations,
      'exact-game-entry-discovery',
      normalize(path.relative(repoRoot, gamesRoot)),
      `${gameEntries.length} game.ts pour ${manifests.length} manifestes.`,
    );
  }

  for (const directory of directories(gamesRoot)) {
    const segment = path.basename(directory).toLowerCase();
    if (forbiddenGameLayers.has(segment)) {
      add(
        violations,
        'no-framework-layer-per-game',
        normalize(path.relative(repoRoot, directory)),
        `Dossier d'ancienne architecture interdit: ${segment}.`,
      );
    }
  }

  for (const file of walk(gamesRoot).filter((entry) => entry.endsWith('.ts'))) {
    const relative = normalize(path.relative(repoRoot, file));
    const source = fs.readFileSync(file, 'utf8');
    const basename = path.basename(file);
    if (
      /\.(module|service|presenter|registrar)\.ts$/.test(basename) ||
      basename === 'rulebook.ts' ||
      forbiddenLegacyFilePatterns.some((pattern) => pattern.test(basename))
    ) {
      add(
        violations,
        'no-framework-file-per-game',
        relative,
        `Fichier d'ancienne architecture interdit: ${basename}.`,
      );
    }
    if (/from\s+['"]@nestjs|require\s*\(\s*['"]@nestjs/.test(source)) {
      add(
        violations,
        'framework-free-games',
        relative,
        'Import NestJS interdit.',
      );
    }
    if (/\b(?:Math\.random|Date\.now)\s*\(/.test(source)) {
      add(
        violations,
        'deterministic-rules',
        relative,
        'Utiliser ctx.random ou ctx.clock.',
      );
    }
    if (/\bmetadata\b/.test(source) && !basename.endsWith('.spec.ts')) {
      add(
        violations,
        'typed-game-state',
        relative,
        'Un jeu ne doit pas stocker son état dans metadata.',
      );
    }
    if (!basename.endsWith('.spec.ts') && lineCount(source) > 550) {
      add(
        violations,
        'game-file-size',
        relative,
        `Fichier de ${lineCount(source)} lignes (limite 550).`,
      );
    }
    if (!basename.endsWith('.spec.ts')) {
      inspectUnsafeTypes(source, relative, violations);
    }
  }
}

function auditEngine(gameRoot, runtimeRoot, violations) {
  for (const file of walk(gameRoot).filter(
    (entry) => entry.endsWith('.ts') && !entry.endsWith('.spec.ts'),
  )) {
    const relative = normalize(path.relative(repoRoot, file));
    const source = fs.readFileSync(file, 'utf8');
    inspectUnsafeTypes(source, relative, violations);
    for (const symbol of forbiddenLegacySymbols) {
      const matcher = new RegExp(`\\b${symbol}\\b`);
      if (matcher.test(source)) {
        add(
          violations,
          'single-runtime-api',
          relative,
          `Symbole d'ancienne génération interdit: ${symbol}.`,
        );
      }
    }
  }
  for (const file of walk(runtimeRoot).filter(
    (entry) => entry.endsWith('.ts') && !entry.endsWith('.spec.ts'),
  )) {
    const relative = normalize(path.relative(repoRoot, file));
    const lines = lineCount(fs.readFileSync(file, 'utf8'));
    if (lines > 500) {
      add(
        violations,
        'runtime-file-size',
        relative,
        `Fichier runtime de ${lines} lignes (limite 500).`,
      );
    }
  }

  const runtimeContract = fs.readFileSync(
    path.join(
      gameRoot,
      'core',
      'application',
      'contracts',
      'game-runtime.interface.ts',
    ),
    'utf8',
  );
  for (const method of [
    'hydrateInitialState',
    'validateActor',
    'validateAction',
    'applyActions',
    'getAvailableActions',
    'exposeStateForUser',
    'getBotActions',
    'getAutomaticActions',
    'getShortcuts',
  ]) {
    if (!new RegExp(`\\b${method}\\s*\\(`).test(runtimeContract)) {
      add(
        violations,
        'complete-runtime-contract',
        'src/game/core/application/contracts/game-runtime.interface.ts',
        `Méthode obligatoire absente: ${method}.`,
      );
    }
  }
}

function auditCli(violations) {
  const cli = require(path.join(repoRoot, 'commands', 'create-game.cjs'));
  if (JSON.stringify(cli.GENERATED_FILES) !== JSON.stringify(standardFiles)) {
    add(
      violations,
      'five-file-cli',
      'commands/create-game.cjs',
      'Le CLI doit générer exactement les cinq fichiers standards, dans cet ordre.',
    );
  }
}

function auditGameEngineArchitecture(options = {}) {
  const gamesRoot = options.gamesRoot ?? defaultGamesRoot;
  const gameRoot = options.gameRoot ?? defaultGameRoot;
  const runtimeRoot = options.runtimeRoot ?? defaultRuntimeRoot;
  const violations = [];
  auditGamePackages(gamesRoot, violations);
  auditEngine(gameRoot, runtimeRoot, violations);
  if (!options.skipCli) auditCli(violations);
  return violations.sort((left, right) =>
    `${left.rule}:${left.file}`.localeCompare(`${right.rule}:${right.file}`),
  );
}

function main() {
  const violations = auditGameEngineArchitecture();
  if (violations.length === 0) {
    console.log(
      'game-engine-architecture: OK (0 violation, baseline interdite)',
    );
    return;
  }
  console.error(`game-engine-architecture: ${violations.length} violation(s)`);
  for (const violation of violations) {
    console.error(
      `- ${violation.rule}: ${violation.file}: ${violation.message}`,
    );
  }
  process.exitCode = 1;
}

module.exports = { auditGameEngineArchitecture, standardFiles };

if (require.main === module) main();
