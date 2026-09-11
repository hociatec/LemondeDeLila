#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const { inspectManifestAuthoring } = require('./game-manifest-authoring.cjs');
const { inspectGameExternalEffects } = require('./game-external-effects.cjs');
const { inspectGameComposition, inspectRuleContracts } = require('./game-composition-boundary.cjs');
const {
  inspectGameImports,
  inspectGameCycles,
  inspectGameLayers,
} = require('./game-import-boundaries.cjs');

const repoRoot = path.resolve(__dirname, '..');
const defaultGamesRoot = path.join(repoRoot, 'src', 'game', 'games');
const defaultGameRoot = path.join(repoRoot, 'src', 'game');
const defaultRuntimeRoot = path.join(
  repoRoot,
  'src',
  'game',
  'engine',
  'runtime',
);
const standardFiles = ['game.ts', 'rules.ts', 'content.ts', 'game.spec.ts'];
const SDK_PUBLIC_SURFACE = Object.freeze({
  exportCount: 81,
  sha256: '98b6979e61b1b463862c7cca60c205b45f935fee9c3bfd6690d5d46f05fb45b2',
});
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

function inspectUnsafeTypes(
  source,
  relative,
  violations,
  enforceBoundaryCasts = true,
) {
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
  if (enforceBoundaryCasts && /\bas\s+unknown\s+as\b/.test(source)) {
    add(
      violations,
      'no-double-cast',
      relative,
      'Les doubles casts via unknown sont interdits.',
    );
  }
  if (enforceBoundaryCasts && /\bmetadata\s+as\b/.test(source)) {
    add(
      violations,
      'typed-engine-state',
      relative,
      'Les casts de metadata sont interdits.',
    );
  }
}

function auditGamePackages(gamesRoot, violations) {
  for (const chain of inspectGameLayers(walk(gamesRoot).filter(file => file.endsWith('.ts') && !file.endsWith('.spec.ts')))) {
    add(violations, 'game-dependency-direction', chain[0], chain.map(file => normalize(path.relative(gamesRoot, file))).join(' -> '));
  }
  for (const cycle of inspectGameCycles(
    walk(gamesRoot).filter(
      (file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'),
    ),
  )) {
    add(
      violations,
      'acyclic-game-files',
      cycle[0],
      cycle
        .map((file) => normalize(path.relative(gamesRoot, file)))
        .join(' -> '),
    );
  }
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

    const jsonOnly = fs.existsSync(path.join(gameDirectory, 'game.json'));
    if (jsonOnly && walk(gameDirectory).some(file => file.endsWith('.ts') && !file.endsWith('.spec.ts'))) {
      add(violations, 'json-game-no-executable-source', relativeDirectory,
        'Un jeu JSON ne doit pas contenir de logique TypeScript parallèle.');
    }
    for (const file of jsonOnly ? ['game.json', 'rules.md'] : standardFiles) {
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
      const { declaredId, canonical } = inspectManifestAuthoring(source, id);
      if (!canonical) {
        add(violations, 'canonical-manifest-metadata', normalize(path.relative(repoRoot, gameFile)), 'Identité, nom, description et limites de joueurs doivent dériver du manifeste importé.');
      }
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
    (file) => ['game.ts', 'game.json'].includes(path.basename(file)),
  );
  if (gameEntries.length !== manifests.length) {
    add(
      violations,
      'exact-game-entry-discovery',
      normalize(path.relative(repoRoot, gamesRoot)),
      `${gameEntries.length} entrées de jeu pour ${manifests.length} manifestes.`,
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
    if (basename === 'rules.ts') {
      for (const message of inspectRuleContracts(file, source))
        add(violations, 'game-rule-contracts', relative, message);
    }
    if (basename === 'game.ts') {
      for (const message of inspectGameComposition(file, source))
        add(violations, 'game-composition-only', relative, message);
    }
    const gameDirectory = findGameDirectory(file, gamesRoot);
    if (gameDirectory) {
      for (const message of inspectGameImports(file, source, gameDirectory)
        .violations) {
        add(violations, 'game-sdk-boundary', relative, message);
      }
    }
    if (
      ['rules.ts', 'content.ts'].includes(basename) &&
      lineCount(source) > 400
    ) {
      add(
        violations,
        'bounded-game-entry-file',
        relative,
        `${basename} dépasse 400 lignes; extraire un mécanisme ou une famille de contenu.`,
      );
    }
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
    if (/\b(?:Math\.random|Date\.now)\s*\(|\bnew\s+Date\s*\(/.test(source)) {
      add(
        violations,
        'deterministic-rules',
        relative,
        'Utiliser ctx.random ou ctx.clock.',
      );
    }
    for (const message of inspectGameExternalEffects(file, source)) {
      add(violations, 'no-external-game-effects', relative, message);
    }
    if (/\.\s*(?:match|matchAll|search|test|normalize)\s*\(/.test(source)) {
      add(
        violations,
        'structured-game-content',
        relative,
        'Les jeux consomment des identifiants et effets structurés ; isoler la validation générique dans le SDK et ne pas interpréter le texte UX.',
      );
    }
    if (/\bthrow\s+new\s+(?:Error|RangeError|TypeError)\s*\(/.test(source)) {
      add(
        violations,
        'typed-game-errors',
        relative,
        'Utiliser ctx.reject, rejectRule ou rejectContent.',
      );
    }
    if (/structuredClone\s*\(\s*state\s*\)/.test(source)) {
      add(
        violations,
        'explicit-player-projection',
        relative,
        'Une vue joueur doit utiliser une projection explicite des champs.',
      );
    }
    if (
      basename === 'game.ts' &&
      /\bcards\.deck\s*\(/.test(source) &&
      !/\bdefineCardsSchema\s*\(/.test(source)
    ) {
      add(
        violations,
        'typed-card-schema',
        relative,
        'Toute déclaration directe de pioche doit passer par defineCardsSchema().',
      );
    }
    if (/ctx\.history\.add\s*\(/.test(source)) {
      add(
        violations,
        'structured-game-events',
        relative,
        'Utiliser ctx.events avec un type et des données structurées.',
      );
    }
    if (/\bavailableInputs\s*:/.test(source)) {
      add(
        violations,
        'separate-action-validation',
        relative,
        'Utiliser validate pour l’autorité serveur et enumerate pour la découverte.',
      );
    }
    if (/\bGameRuleContext\b/.test(source)) {
      add(
        violations,
        'canonical-game-context',
        relative,
        'Utiliser GameContext comme façade métier publique.',
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
    if (
      !basename.endsWith('.spec.ts') &&
      /\b(?:ctx|state)\.engine\b/.test(source)
    ) {
      add(
        violations,
        'encapsulated-engine-state',
        relative,
        'Un jeu ne doit jamais accéder directement à l’état interne du moteur.',
      );
    }
    if (
      /\bconsole\.(?:log|info|warn|error)\s*\(|\bnew\s+Logger\s*\(/.test(source)
    ) {
      add(
        violations,
        'no-server-game-log',
        relative,
        'Les règles métier doivent produire des événements structurés.',
      );
    }
    for (const specifier of importSpecifiers(source)) {
      if (/(?:^|\/)(?:infrastructure|persistence)(?:\/|$)/.test(specifier)) {
        add(
          violations,
          'persistence-free-games',
          relative,
          `Import de persistence/infrastructure interdit: ${specifier}.`,
        );
      }
      if (!gameDirectory || !specifier.startsWith('.')) continue;
      const target = path.resolve(path.dirname(file), specifier);
      if (
        target.startsWith(`${gamesRoot}${path.sep}`) &&
        !target.startsWith(`${gameDirectory}${path.sep}`) &&
        target !== gameDirectory
      ) {
        add(
          violations,
          'no-cross-game-dependency',
          relative,
          `Dépendance vers un autre jeu interdite: ${specifier}.`,
        );
      }
    }
    if (!basename.endsWith('.spec.ts') && lineCount(source) > 500) {
      add(
        violations,
        'game-file-size',
        relative,
        `Fichier de ${lineCount(source)} lignes (limite 500).`,
      );
    }
    if (!basename.endsWith('.spec.ts')) {
      inspectUnsafeTypes(source, relative, violations);
    }
  }
}

function findGameDirectory(file, gamesRoot) {
  let directory = path.dirname(file);
  while (directory.startsWith(gamesRoot)) {
    if (fs.existsSync(path.join(directory, 'manifest.json'))) return directory;
    if (directory === gamesRoot) break;
    directory = path.dirname(directory);
  }
  return null;
}

function importSpecifiers(source) {
  const specifiers = [];
  const matcher = /(?:from\s+|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/g;
  for (let match = matcher.exec(source); match; match = matcher.exec(source)) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

function auditEngine(gameRoot, runtimeRoot, violations) {
  for (const file of walk(gameRoot).filter(
    (entry) => entry.endsWith('.ts') && !entry.endsWith('.spec.ts'),
  )) {
    const relative = normalize(path.relative(repoRoot, file));
    const source = fs.readFileSync(file, 'utf8');
    inspectUnsafeTypes(source, relative, violations, false);
    const gameRelative = normalize(path.relative(gameRoot, file));
    if (!gameRelative.startsWith('composition/') && /\b(?:readdirSync|readdir|opendirSync|opendir|globSync|glob)\s*\(/.test(source)) {
      add(violations, 'composition-game-discovery', relative, 'La découverte des dossiers de jeux appartient à la composition du build.');
    }
    const isCompositionRoot =
      relative === 'src/game/composition/generated-game-registry.ts';
    if (
      !file.startsWith(`${gamesRootForFile(gameRoot)}${path.sep}`) &&
      !isCompositionRoot
    ) {
      for (const specifier of importSpecifiers(source)) {
        const target = specifier.startsWith('.')
          ? path.resolve(path.dirname(file), specifier)
          : null;
        if (
          /(?:^|\/)games(?:\/|$)/.test(specifier) ||
          target?.startsWith(`${gamesRootForFile(gameRoot)}${path.sep}`)
        ) {
          add(
            violations,
            'engine-does-not-import-games',
            relative,
            `Le moteur ne doit pas importer un jeu concret: ${specifier}.`,
          );
        }
      }
    }
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
      'ports',
      'game-runtime.port.ts',
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
    'getDescriptor',
  ]) {
    if (!new RegExp(`\\b${method}\\s*\\(`).test(runtimeContract)) {
      add(
        violations,
        'complete-runtime-contract',
        'src/game/core/application/ports/game-runtime.port.ts',
        `Méthode obligatoire absente: ${method}.`,
      );
    }
  }
}

function gamesRootForFile(gameRoot) {
  return path.join(gameRoot, 'games');
}

function auditCli(violations) {
  const cli = require(path.join(repoRoot, 'commands', 'create-game.cjs'));
  if (JSON.stringify(cli.GENERATED_FILES) !== JSON.stringify([...standardFiles, 'manifest.json', 'rules.md'])) {
    add(
      violations,
      'complete-game-package-cli',
      'commands/create-game.cjs',
      'Le CLI doit générer les quatre fichiers TypeScript, le manifeste et les règles.',
    );
  }
}

function auditSdkPublicSurface(expected = SDK_PUBLIC_SURFACE) {
  const configPath = ts.findConfigFile(
    repoRoot,
    ts.sys.fileExists,
    'tsconfig.json',
  );
  if (!configPath) throw new Error('tsconfig.json introuvable');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    path.dirname(configPath),
  );
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const checker = program.getTypeChecker();
  const sdkFile = program.getSourceFile(
    path.join(repoRoot, 'src/game/engine/sdk/public-api.ts'),
  );
  const sdkSymbol = sdkFile && checker.getSymbolAtLocation(sdkFile);
  if (!sdkFile || !sdkSymbol) {
    return [
      {
        rule: 'sdk-public-surface',
        file: 'src/game/engine/sdk/public-api.ts',
        message: 'Surface publique SDK impossible à résoudre.',
      },
    ];
  }
  const names = checker
    .getExportsOfModule(sdkSymbol)
    .map((symbol) => symbol.name)
    .sort();
  const sha256 = crypto
    .createHash('sha256')
    .update(names.join('\n'))
    .digest('hex');
  if (names.length === expected.exportCount && sha256 === expected.sha256) {
    return [];
  }
  return [
    {
      rule: 'sdk-public-surface',
      file: 'src/game/engine/sdk/public-api.ts',
      message:
        `Surface modifiée: ${names.length} exports, sha256=${sha256}. ` +
        'Toute évolution doit être versionnée et le contrat mis à jour explicitement.',
    },
  ];
}

function auditGameEngineArchitecture(options = {}) {
  const gamesRoot = options.gamesRoot ?? defaultGamesRoot;
  const gameRoot = options.gameRoot ?? defaultGameRoot;
  const runtimeRoot = options.runtimeRoot ?? defaultRuntimeRoot;
  const violations = [];
  auditGamePackages(gamesRoot, violations);
  auditEngine(gameRoot, runtimeRoot, violations);
  if (!options.skipCli) auditCli(violations);
  if (!options.skipSdk && !options.skipCli) {
    violations.push(...auditSdkPublicSurface());
  }
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

module.exports = {
  auditGameEngineArchitecture,
  auditSdkPublicSurface,
  SDK_PUBLIC_SURFACE,
  standardFiles,
};

if (require.main === module) main();
