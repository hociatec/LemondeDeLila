const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

test('Panier effects use bounded declarative bindings', () => {
  const output = execFileSync(process.execPath, ['tools/panier-effects-audit.cjs'], {
    encoding: 'utf8',
  });
  assert.match(output, /engine-owned declarative bindings/);
});
