const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const { createGame, GAME_TEMPLATES } = require('./create-game.cjs');
const { generateGameRegistry } = require('./generate-game-registry.cjs');

test('every generated template is discoverable and invalid packages cannot replace the registry', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lila-registry-'));
  try {
    fs.mkdirSync(path.join(root, 'composition'));
    for (const template of GAME_TEMPLATES) {
      await createGame({gamesRoot: path.join(root, 'games'), world: 'examples', code: `example-${template}`, name: `Example ${template}`, minPlayers: 2, maxPlayers: 4, template});
    }
    assert.equal(generateGameRegistry({sourceRoot: root}), GAME_TEMPLATES.length);
    const output = path.join(root, 'composition/generated-game-registry.ts');
    const original = fs.readFileSync(output, 'utf8');
    const indexFile = path.join(root, 'core/infrastructure/system/generated-game-catalog-index.json');
    const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    assert.deepEqual(index, [...GAME_TEMPLATES].sort().map(template => ({ code: `example-${template}`, directory: `examples/example-${template}` })));
    assert.match(original, /GENERATED_GAME_PACKAGES/);
    assert.equal((original.match(/import manifest\d+ from/g) ?? []).length, GAME_TEMPLATES.length);
    const manifestPath = path.join(root, 'games/examples/example-empty/manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    fs.writeFileSync(manifestPath, JSON.stringify({...manifest, engine: 'obsolete'}));
    assert.throws(() => generateGameRegistry({sourceRoot: root}), /Identité/);
    assert.equal(fs.readFileSync(output, 'utf8'), original);
    assert.deepEqual(JSON.parse(fs.readFileSync(indexFile, 'utf8')), index);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    fs.unlinkSync(path.join(path.dirname(manifestPath), 'rules.md'));
    assert.throws(() => generateGameRegistry({sourceRoot: root}), /rules.md manquant/);
    assert.equal(fs.readFileSync(output, 'utf8'), original);
  } finally {
    assert(path.dirname(root) === fs.realpathSync(os.tmpdir()) || path.dirname(root) === path.resolve(os.tmpdir()));
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test('registry discovers a JSON-only game profile', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lila-json-registry-'));
  try {
    fs.mkdirSync(path.join(root, 'composition'));
    await createGame({
      gamesRoot: path.join(root, 'games'),
      world: 'examples',
      code: 'json-pass',
      name: 'JSON Pass',
      minPlayers: 1,
      maxPlayers: 4,
      jsonOnly: true,
    });
    assert.equal(generateGameRegistry({ sourceRoot: root }), 1);
    const registry = fs.readFileSync(path.join(root, 'composition/generated-game-registry.ts'), 'utf8');
    assert.match(registry, /compileJsonGame/);
    assert.match(registry, /json-pass\/manifest\.json/);
    assert.match(registry, /json-pass\/game\.json/);
    assert.match(registry, /compileJsonGame\(manifest0, document0\)/);
    assert.equal((registry.match(/compileJsonGame\(/g) ?? []).length, 1);
    await createGame({ gamesRoot: path.join(root, 'games'), world: 'examples', code: 'json-second', name: 'Second', minPlayers: 1, maxPlayers: 4, jsonOnly: true });
    assert.equal(generateGameRegistry({ sourceRoot: root }), 2);
    const multiple = fs.readFileSync(path.join(root, 'composition/generated-game-registry.ts'), 'utf8');
    assert.equal((multiple.match(/import \{ compileJsonGame \}/g) ?? []).length, 1);
    assert.equal((multiple.match(/compileJsonGame\(/g) ?? []).length, 2);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
