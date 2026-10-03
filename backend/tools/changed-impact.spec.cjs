'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { planImpact } = require('./changed-impact.cjs');

const matrix = {
  games: [
    { id: 'cards-game', mechanics: { cards: ['game.json:1'], zones: [] } },
    { id: 'race-game', mechanics: { movement: ['game.json:1'] } },
  ],
  extensions: [{ name: 'auction', consumers: ['cards-game'] }],
};

test('a game-only change targets that game', () => {
  const plan = planImpact(
    ['backend/src/game/games/family/race-game/game.json'],
    matrix,
  );
  assert.deepEqual(plan.games, ['race-game']);
  assert.equal(plan.allGames, false);
});

test('a known primitive targets only consumers', () => {
  const plan = planImpact(
    ['backend/src/game/engine/runtime/cards/card-draw.ts'],
    matrix,
  );
  assert.deepEqual(plan.games, ['cards-game']);
  assert.equal(plan.allGames, false);
});

test('unmapped runtime core changes certify every game', () => {
  const plan = planImpact(
    ['backend/src/game/engine/runtime/definitions/game-definition.ts'],
    matrix,
  );
  assert.equal(plan.allGames, true);
  assert.deepEqual(plan.games, []);
});

test('an extension targets its declared consumers', () => {
  const plan = planImpact(
    ['backend/src/game/rules/game-specific/auction/engine-extension.ts'],
    matrix,
  );
  assert.deepEqual(plan.games, ['cards-game']);
});
