const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

test('generic game sequence inventory is populated', () => {
  const output = execFileSync(process.execPath, ['tools/game-generic-sequences-audit.cjs'], {
    encoding: 'utf8',
  });
  assert.match(output, /Generic game sequence audit:/);
});
