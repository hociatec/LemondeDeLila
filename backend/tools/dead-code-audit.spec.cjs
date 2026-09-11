const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

test('strict dead code compilation passes', () => {
  const output = execFileSync(process.execPath, ['tools/dead-code-audit.cjs'], { encoding: 'utf8' });
  assert.match(output, /no unused locals or parameters/);
});
