'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const backend = path.resolve(__dirname, '..');

test('content publication retains immutable historical releases', () => {
  const source = fs.readFileSync(
    path.join(__dirname, 'content-release.cjs'),
    'utf8',
  );
  assert.match(source, /writeFileSync\([^\n]+\{ flag: 'wx' \}/);
  assert.match(source, /validateRelease\(temporary\)[\s\S]*renameSync\(temporary, target\)/);
  assert.doesNotMatch(source, /(?:rmSync|unlinkSync|rmdirSync)\(/);

});

test('snapshot migrations remain static and deterministic', () => {
  const source = fs.readFileSync(
    path.join(
      backend,
      'src/game/engine/runtime/content/engine-snapshot-migrations.ts',
    ),
    'utf8',
  );
  assert.doesNotMatch(
    source,
    /\b(?:Date|fetch|setTimeout|setInterval|Math\.random|process\.|require\s*\()/,
  );
  assert.doesNotMatch(source, /\basync\b|\bawait\b/);
});
