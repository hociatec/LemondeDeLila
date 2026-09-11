const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

test('application data contracts are role-oriented', () => {
  const output = execFileSync(process.execPath, ['tools/application-contract-placement-audit.cjs'], { encoding: 'utf8' });
  assert.match(output, /role-oriented definitions/);
});
