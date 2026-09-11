const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

test('runtime is separated from compiler internals', () => {
  const output = execFileSync(process.execPath, ['tools/runtime-separation-audit.cjs'], { encoding: 'utf8' });
  assert.match(output, /compiler-independent/);
});
