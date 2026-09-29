'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

test('certifies every backend closure point with tracked evidence', () => {
  const root = path.resolve(__dirname, '..');
  const result = spawnSync(
    process.execPath,
    ['tools/backend-closure-evidence.cjs'],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /OK \(272 points/);
});
