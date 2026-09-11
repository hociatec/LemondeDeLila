require('ts-node/register');
const { performance } = require('node:perf_hooks');
const assert = require('node:assert/strict');
const { gameInput } = require('../src/game/engine/runtime/actions/game-input-schema');
const input = gameInput.object({
  name: gameInput.string({ min: 1, max: 128 }),
  playerId: gameInput.number({ integer: true, min: 1 }),
  score: gameInput.number({ integer: true, min: 0, max: 10000 }),
  enabled: gameInput.boolean(),
  tag: gameInput.enum(['one', 'two', 'three', 'four', 'five', 'six']),
  items: gameInput.array(gameInput.object({
    name: gameInput.string({ min: 1 }),
    quantity: gameInput.number({ integer: true, min: 0 }),
  }), { max: 8 }),
  choice: gameInput.optional(gameInput.numberEnum([1, 2, 3, 4])),
});
const value = { name: 'Lila', playerId: 7, score: 42, enabled: true, tag: 'three', items: [{ name: 'card', quantity: 2 }], choice: 2 };
const iterations = 100000, samples = [];
let checksum = 0;
for (let index = 0; index < 20000; index++) checksum += input.parse(value).score;
for (let round = 0; round < 7; round++) {
  const start = performance.now();
  for (let index = 0; index < iterations; index++) checksum += input.parse(value).score;
  samples.push(performance.now() - start);
}
assert.equal(checksum, (20000 + iterations * 7) * 42);
assert.deepEqual(input.parse(value), value);
const sorted = [...samples].sort((a,b) => a-b);
console.log(JSON.stringify({ label: process.argv[2] || 'measurement', iterationsPerSample: iterations, samplesMs: samples.map(value => Number(value.toFixed(2))), medianMs: Number(sorted[3].toFixed(2)), maxMs: Number(sorted.at(-1).toFixed(2)), checksum }, null, 2));
