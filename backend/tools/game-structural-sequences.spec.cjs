'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { inspectSources } = require('./game-structural-sequences.cjs');

function audit(first, second) {
  return inspectSources([
    { game: 'first', file: 'first/rules.ts', source: first },
    { game: 'second', file: 'second/rules.ts', source: second },
  ]);
}
test('finds partial sequences despite renamed locals, literals and extra logging', () => {
  const result = audit(
    'function resolve(ctx, actor) { const n = ctx.dice.roll("main"); ctx.movement.move("road", actor.id, n.total); ctx.turn.end(); }',
    'function play(context, player) { const value = context.dice.roll("other"); context.events.message("log", {}); context.movement.move("river", player.id, value.total + 1); context.turn.end(); context.score.add(player.id, 1); }',
  );
  assert.equal(result.candidates.length, 1);
  assert.deepEqual(result.candidates[0].sequence, ['/straight:dice.roll', '/straight:movement.move', '/straight:turn.end']);
});
test('distinguishes control flow and execution order', () => {
  const straight = 'function f(ctx) { ctx.cards.draw(); ctx.cards.discard(); ctx.turn.end(); }';
  assert.equal(audit(straight, 'function f(ctx) { ctx.cards.discard(); ctx.cards.draw(); ctx.turn.end(); }').candidates.length, 0);
  assert.equal(audit(straight, 'function f(ctx) { if (ready) { ctx.cards.draw(); ctx.cards.discard(); ctx.turn.end(); } }').candidates.length, 0);
});
test('does not join nested callbacks to their enclosing handler or count comments', () => {
  const source = 'function f(ctx) { ctx.cards.draw(); later(() => { ctx.cards.discard(); }); ctx.turn.end(); /* ctx.score.add(); */ }';
  assert.equal(audit(source, source).candidates.length, 0);
});
test('does not claim repeated calls within one game are inter-game duplication', () => {
  const source = 'function f(ctx) { ctx.dice.roll(); ctx.movement.move(); ctx.turn.end(); }';
  assert.equal(inspectSources([{ game: 'one', file: 'rules.ts', source: source + source }]).candidates.length, 0);
});
test('reports an empty inventory successfully and rejects unparseable input', () => {
  assert.deepEqual(inspectSources([]).candidates, []);
  assert.throws(() => audit('function f( {', ''), /Cannot audit/);
});
