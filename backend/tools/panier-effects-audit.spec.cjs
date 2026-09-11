const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

test('Panier effects are game-specific', () => {
  const output = execFileSync(process.execPath, ['tools/panier-effects-audit.cjs'], {
    encoding: 'utf8',
  });
  assert.match(output, /game-specific effects/);
});
