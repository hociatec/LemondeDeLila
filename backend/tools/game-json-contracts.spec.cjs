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
  const migrations = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'game-json-migrations.json'), 'utf8'),
  ).migrations;
  const actual = inventory();
  assert.equal(actual.length, baseline.files.length);
  for (const [index, current] of actual.entries()) {
    const previous = baseline.files[index];
    assert.equal(current.file, previous.file);
    if (current.sha256 === previous.sha256) {
      assert.deepEqual(current, previous);
      continue;
    }
    const migration = migrations.find(
      (entry) =>
        entry.file === current.file &&
        entry.fromSha256 === previous.sha256 &&
        entry.toSha256 === current.sha256,
    );
    assert.ok(migration, `${current.file}: missing exact migration contract`);
    assert.ok(BigInt(current.contentVersion) > BigInt(previous.contentVersion));
  }
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
