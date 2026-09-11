const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

test('architecture debt final invariants remain enforceable', () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'architecture-debt-final-check.cjs')], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

for (const [file, field] of [
  ['architecture-baseline.json', 'groups'],
  ['structural-quality-baseline.json', 'violations'],
]) {
  test(`rejects reintroduced debt exemptions in ${file}`, (context) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lila-architecture-'));
    context.after(() => {
      assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
      fs.rmSync(directory, { recursive: true, force: true });
    });
    fs.mkdirSync(path.join(directory, 'tools'));
    fs.mkdirSync(path.join(directory, 'src'));
    const script = path.join(directory, 'tools', 'architecture-debt-final-check.cjs');
    fs.copyFileSync(path.join(__dirname, 'architecture-debt-final-check.cjs'), script);
    fs.writeFileSync(path.join(directory, 'tools', 'architecture-baseline.json'), JSON.stringify({ groups: [] }));
    fs.writeFileSync(path.join(directory, 'tools', 'structural-quality-baseline.json'), JSON.stringify({ violations: [] }));
    fs.writeFileSync(path.join(directory, 'tools', file), JSON.stringify({ [field]: [{ rule: 'grandfathered' }] }));
    const result = spawnSync(process.execPath, [script], { cwd: directory, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /temporary architecture exceptions are forbidden/);
    assert.ok(result.stderr.includes(file));
  });
}
