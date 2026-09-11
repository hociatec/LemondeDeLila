const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

test('Panier bindings and setup remain thin', () => {
  const output = execFileSync(process.execPath, ['tools/panier-wiring-audit.cjs'], {
    encoding: 'utf8',
  });
  assert.match(output, /declarative bindings/);
});
