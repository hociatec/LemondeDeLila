'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const {
  compareEvolution,
  captureEvolution,
} = require('./engine-evolution-report.cjs');

test('catalogue reports declarativity and reuse independently with real primitive identities', () => {
  const report = captureEvolution();
  assert.equal(report.declarativity.jsonGames, report.games.length);
  assert.equal(report.reuse.reusable, report.engineExtensions.length);
  assert.ok(report.primitives.length > 0);
  assert.ok(report.primitives.every((id) => !id.includes('undefined')));
  assert.equal(new Set(report.games).size, report.games.length);
});

test('new declarative game without a new extension or primitive has zero engine growth', () => {
  const before = {
    games: ['first'],
    engineExtensions: ['extension'],
    primitives: ['move'],
  };
  const after = { ...before, games: ['first', 'second'] };
  assert.deepEqual(compareEvolution(after, before), {
    games: ['second'],
    engineExtensions: [],
    primitives: [],
    requiresReview: false,
    counts: {
      newGames: 1,
      newEngineExtensions: 0,
      newPrimitives: 0,
      gamesPerNewEngineExtension: null,
      gamesPerNewPrimitive: null,
    },
  });
});
test('growth counts new identities even when an old extension is removed', () => {
  const before = {
    games: ['first'],
    engineExtensions: ['old'],
    primitives: ['move'],
  };
  const after = {
    games: ['first', 'second'],
    engineExtensions: ['replacement'],
    primitives: ['move', 'score'],
  };
  const report = compareEvolution(after, before);
  assert.equal(report.counts.gamesPerNewEngineExtension, 1);
  assert.equal(report.counts.gamesPerNewPrimitive, 1);
  assert.equal(report.requiresReview, true);
});
