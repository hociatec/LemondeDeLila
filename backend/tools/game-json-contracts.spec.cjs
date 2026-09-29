'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  digest,
  inventory,
  migrationKey,
} = require('./game-json-contracts.cjs');

test('snapshots every canonical game document byte for byte', () => {
  const baseline = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'game-json-contracts.json'), 'utf8'),
  );
  assert.equal(baseline.files.length, 39);
  assert.deepEqual(inventory(), baseline.files);
});

test('binds a migration declaration to its exact old and new hashes', () => {
  const before = digest(Buffer.from('{"version":1}\n'));
  const after = digest(Buffer.from('{"version":2}\n'));
  assert.notEqual(before, after);
  assert.equal(
    migrationKey('game.json', before, after),
    `game.json\n${before}\n${after}`,
  );
});
