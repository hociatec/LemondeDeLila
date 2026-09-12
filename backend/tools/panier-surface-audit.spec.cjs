const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

test('Panier keeps its authored surface bounded and declarative', () => {
  const output = execFileSync(
    process.execPath,
    ['tools/panier-surface-audit.cjs'],
    { encoding: 'utf8' },
  );
  assert.match(output, /zero production TypeScript files/);
  assert.match(output, /rules and content in game\.json/);
});
