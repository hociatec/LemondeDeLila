const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

test('game text parser audit is clean', () => {
  const output = execFileSync(process.execPath, ['tools/game-text-parser-audit.cjs'], { encoding: 'utf8' });
  assert.match(output, /0 violations/);
});
