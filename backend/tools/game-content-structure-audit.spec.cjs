const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

test('all game content modules are structured', () => {
  const output = execFileSync(process.execPath, ['tools/game-content-structure-audit.cjs'], { encoding: 'utf8' });
  assert.match(output, /structured content modules/);
});
