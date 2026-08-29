const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { auditFile } = require('./persistence-audit.cjs');

function fixture(relative, source) {
  const root = path.resolve(__dirname, '..', 'src');
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, source);
  return target;
}

test('detects unbounded TypeORM collections', () => {
  const name = `persistence-audit-${process.pid}-${Date.now()}.ts`;
  const target = fixture(
    `audit-fixtures/infrastructure/persistence/typeorm/repositories/${name}`,
    'repo.find({ where: { active: true } });',
  );
  try {
    assert.match(auditFile(target).join('\n'), /sans limite take/);
  } finally {
    fs.rmSync(
      path.dirname(
        path.dirname(path.dirname(path.dirname(path.dirname(target)))),
      ),
      { recursive: true, force: true },
    );
  }
});

test('accepts bounded TypeORM collections', () => {
  const target = path.join(os.tmpdir(), `bounded-${process.pid}.spec.ts`);
  fs.writeFileSync(target, 'repo.find({ take: 50 });');
  try {
    assert.deepEqual(auditFile(target), []);
  } finally {
    fs.rmSync(target, { force: true });
  }
});
