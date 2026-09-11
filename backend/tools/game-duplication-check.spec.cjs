'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { inspectDuplicates } = require('./game-duplication-check.cjs');

test('requires review at the second game, including helpers with renamed identifiers', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lila-clones-'));
  try {
    const source = (name) =>
      `export function ${name}(ctx) { ${Array.from({ length: 30 }, (_, i) => `ctx.step(${i});`).join('\n')} }`;
    for (const game of ['first', 'second']) fs.mkdirSync(path.join(root, game));
    fs.writeFileSync(
      path.join(root, 'first', 'resolution.ts'),
      source('resolve'),
    );
    assert.equal(inspectDuplicates(root).length, 0);
    fs.writeFileSync(
      path.join(root, 'second', 'effects.spec.ts'),
      source('testOnly'),
    );
    assert.equal(inspectDuplicates(root).length, 0);
    fs.writeFileSync(path.join(root, 'second', 'effects.ts'), source('apply'));
    assert.equal(inspectDuplicates(root).length, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
