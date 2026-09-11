'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { GAME_TEMPLATES, GENERATED_FILES, createGame, templates, parseArguments } = require('./create-game.cjs');

test('the JSON-only switch does not consume the following option', () => {
  assert.deepEqual(parseArguments(['example', '--json-only', '--world', 'examples']), {
    code: 'example', options: { 'json-only': 'true', world: 'examples' },
  });
  assert.equal(parseArguments(['example', '--json-only=false']).options['json-only'], 'false');
});

test('all generated templates compile against the production authoring SDK', () => {
  const ts = require('typescript');
  const backend = path.resolve(__dirname, '..');
  const config = ts.readConfigFile(path.join(backend, 'tsconfig.json'), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, backend);
  const options = {...parsed.options, noEmit: true, incremental: false};
  const virtualFiles = new Map();
  const rootNames = [];
  for (const template of GAME_TEMPLATES) {
    const sources = templates({code: `template-${template}`, name: `Template ${template}`, category: 'Test', world: 'test-templates', minPlayers: 2, maxPlayers: 4, template});
    for (const [name, source] of Object.entries(sources)) {
      const file = path.resolve(backend, 'src/game/games/test-templates', `template-${template}`, name);
      virtualFiles.set(file.toLowerCase(), source);
      if (name.endsWith('.ts')) rootNames.push(file);
    }
    assert.match(sources['content.ts'], /defineGameContent/);
    assert.match(sources['content.ts'], /schema:/);
    assert.doesNotMatch(sources['game.ts'], /defineGameContent|core\/application\/public-api/);
  }
  const host = ts.createCompilerHost(options);
  const readFile = host.readFile.bind(host), fileExists = host.fileExists.bind(host);
  host.readFile = file => virtualFiles.get(path.resolve(file).toLowerCase()) ?? readFile(file);
  host.fileExists = file => virtualFiles.has(path.resolve(file).toLowerCase()) || fileExists(file);
  const directoryExists = host.directoryExists.bind(host);
  host.directoryExists = directory => [...virtualFiles.keys()].some(file => file.startsWith(path.resolve(directory).toLowerCase() + path.sep)) || directoryExists(directory);
  host.getSourceFile = (file, languageVersion) => {
    const source = host.readFile(file);
    return source === undefined ? undefined : ts.createSourceFile(file, source, languageVersion, true);
  };
  const program = ts.createProgram(rootNames, options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => backend,
    getCanonicalFileName: file => file,
    getNewLine: () => '\n',
  }));
});

test('create-game generates a complete declarative package with canonical metadata', async () => {
  const gamesRoot = await fsp.mkdtemp(
    path.join(os.tmpdir(), 'lila-create-game-'),
  );
  try {
    const directory = await createGame({
      gamesRoot,
      world: 'vents-tests',
      code: 'high-card',
      name: 'High Card',
      category: 'Cartes',
      minPlayers: 2,
      maxPlayers: 6,
    });

    assert.deepEqual(
      fs.readdirSync(directory).sort(),
      [...GENERATED_FILES].sort(),
    );
    const game = fs.readFileSync(path.join(directory, 'game.ts'), 'utf8');
    assert.match(game, /export default defineGame/);
    assert.match(game, /displayName: manifest\.name/);
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
    assert.equal(manifest.name, 'High Card');
    assert.equal(manifest.code, 'high-card');
    assert.equal(manifest.engine, manifest.code);
    assert.equal(manifest.maxPlayers, 6);
    assert.doesNotMatch(game, /@nestjs|Module|Service|Presenter|registr/i);
    assert.doesNotMatch(
      fs.readFileSync(path.join(directory, 'rules.ts'), 'utf8'),
      /@nestjs|Math\.random|Date\.now/,
    );
  } finally {
    await fsp.rm(gamesRoot, { recursive: true, force: true });
  }
});

test('create-game refuses invalid identifiers and existing folders', async () => {
  const gamesRoot = await fsp.mkdtemp(
    path.join(os.tmpdir(), 'lila-create-game-'),
  );
  const configuration = {
    gamesRoot,
    world: 'tests',
    code: 'valid-game',
    name: 'Valid',
    category: 'Test',
    minPlayers: 2,
    maxPlayers: 4,
  };
  try {
    await assert.rejects(
      createGame({ ...configuration, code: '../escape' }),
      /Code invalide/,
    );
    await createGame(configuration);
    await assert.rejects(createGame(configuration), /existe déjà/);
  } finally {
    await fsp.rm(gamesRoot, { recursive: true, force: true });
  }
});

test('create-game can scaffold a JSON-only engine profile', async () => {
  const gamesRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'lila-json-game-'));
  try {
    const directory = await createGame({
      gamesRoot,
      world: 'json-tests',
      code: 'json-pass',
      name: 'JSON Pass',
      category: 'Test',
      minPlayers: 1,
      maxPlayers: 4,
      jsonOnly: true,
    });
    assert.deepEqual(fs.readdirSync(directory).sort(), ['game.json', 'manifest.json', 'rules.md']);
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'game.json'), 'utf8')).schemaVersion, 1);
    assert.equal(fs.existsSync(path.join(directory, 'game.ts')), false);
  } finally {
    await fsp.rm(gamesRoot, { recursive: true, force: true });
  }
});
