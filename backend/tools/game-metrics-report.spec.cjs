'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  growthReviews,
  inspectFunctions,
  measureGames,
} = require('./game-metrics-report.cjs');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('counts JSON game programs as declarative code and assets as content', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-metrics-'));
  try {
    fs.writeFileSync(path.join(root, 'manifest.json'), '{}');
    fs.writeFileSync(path.join(root, 'game.json'), '{\n"actions": {}\n}');
    fs.writeFileSync(path.join(root, 'cards.json'), '[]');
    const [game] = measureGames(root);
    assert.equal(game.declarativeLoc, 3);
    assert.equal(game.contentLoc, 1);
    assert.equal(game.customRulesLoc, 0);
    assert.equal(game.declarativeShare, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('flags significant custom growth and new games independently of content volume', () => {
  const before = [
    {
      gameId: 'game',
      customRulesLoc: 400,
      declarativeLoc: 100,
      contentLoc: 10,
    },
  ];
  assert.equal(
    growthReviews([{ ...before[0], contentLoc: 10000 }], before).length,
    0,
  );
  assert.equal(
    growthReviews([{ ...before[0], customRulesLoc: 500 }], before).length,
    1,
  );
  assert.equal(
    growthReviews([{ ...before[0], customRulesLoc: 450 }], before).length,
    0,
  );
  assert.equal(
    growthReviews([{ ...before[0], gameId: 'new' }], before)[0].reason,
    'new-game',
  );
});

test('keeps lexical call sequences and separates deferred callbacks', () => {
  const entries = inspectFunctions(
    'rules.ts',
    'function resolve(ctx) { ctx.cards.draw(); ctx.choice.one(() => ctx.cards.discard()); ctx.turn.end(); }',
  );
  assert.deepEqual(entries[0].calls, [
    'ctx.cards.draw',
    'ctx.choice.one',
    'ctx.turn.end',
  ]);
  assert.deepEqual(entries[1].calls, ['ctx.cards.discard']);
});
