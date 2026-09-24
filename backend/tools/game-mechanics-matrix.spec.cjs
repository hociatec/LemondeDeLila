const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildMatrix } = require('./game-mechanics-matrix.cjs');

test('maps every game and specific pack, with real shared resource recipe consumers', () => {
  const matrix = buildMatrix();
  assert.equal(matrix.games.length, 39);
  assert.equal(matrix.packs.length, 38);
  assert(matrix.packs.every((pack) => pack.consumers.length > 0));
  assert(
    matrix.games.every((game) => Object.keys(game.mechanics).length === 14),
  );
  const consumers = matrix.games.filter((game) =>
    game.mechanics.resources.some((reference) => {
      const [file, line] = reference.split(':');
      return fs
        .readFileSync(path.join(__dirname, '..', file), 'utf8')
        .split(/\r?\n/)
        [Number(line) - 1].includes('resourceDeltaEffects(');
    }),
  );
  assert.equal(consumers.length, 2);
  assert.equal(new Set(consumers.flatMap((game) => game.packs)).size, 2);
});
