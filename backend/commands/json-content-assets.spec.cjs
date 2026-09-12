const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const test = require('node:test');
const { jsonContentAssets } = require('./json-content-assets.cjs');
const { generateGameRegistry } = require('./generate-game-registry.cjs');
const { createGame } = require('./create-game.cjs');

async function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lila-json-assets-'));
  try {
    fs.mkdirSync(path.join(root, 'composition'));
    await createGame({ gamesRoot: path.join(root, 'games'), world: 'examples', code: 'sample', name: 'Sample', minPlayers: 1, maxPlayers: 4, jsonOnly: true });
    const game = path.join(root, 'games/examples/sample');
    fs.mkdirSync(path.join(game, 'content'));
    await run({ root, game });
  } finally {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('imports content modules in stable order, including a content file named game.json', async () => {
  await fixture(({ root, game }) => {
    fs.writeFileSync(path.join(game, 'content/z.json'), '[1]');
    fs.writeFileSync(path.join(game, 'content/game.json'), '[2]');
    assert.deepEqual(jsonContentAssets(game).map(asset => asset.relative), ['content/game.json', 'content/z.json']);
    assert.equal(generateGameRegistry({ sourceRoot: root }), 1);
    const generated = fs.readFileSync(path.join(root, 'composition/generated-game-registry.ts'), 'utf8');
    assert.match(generated, /import asset0_0 from '.*content\/game.json'/);
    assert.match(generated, /"content\/game.json": asset0_0/);
    assert.match(generated, /compileJsonGame\(manifest0, document0, \{/);
  });
});

test('does not replace a generated registry when a content module is invalid', async () => {
  await fixture(({ root, game }) => {
    generateGameRegistry({ sourceRoot: root });
    const file = path.join(root, 'composition/generated-game-registry.ts');
    const previous = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(path.join(game, 'content/invalid.json'), '{');
    assert.throws(() => generateGameRegistry({ sourceRoot: root }));
    assert.equal(fs.readFileSync(file, 'utf8'), previous);
  });
});

test('rejects content filenames that cannot be referenced by the closed grammar', async () => {
  await fixture(({ game }) => {
    fs.writeFileSync(path.join(game, 'content/bad name.json'), '{}');
    assert.throws(() => jsonContentAssets(game), /Invalid JSON content path/);
  });
});

test('rejects a content directory junction escaping its game', async () => {
  await fixture(({ root, game }) => {
    fs.symlinkSync(path.join(root, 'composition'), path.join(game, 'content/outside'), 'junction');
    assert.throws(() => jsonContentAssets(game), /links are forbidden/);
    fs.unlinkSync(path.join(game, 'content/outside'));
  });
});
