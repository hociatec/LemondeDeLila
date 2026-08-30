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

test('detects awaited repository work inside loops in every sensitive domain', () => {
  for (const domain of [
    'user',
    'messaging',
    'notification',
    'room',
    'stats',
    'social',
  ]) {
    const target = fixture(
      `modules/${domain}/application/audit-${process.pid}.ts`,
      'for (const id of ids) { await repository.findOneBy({ id }); }',
    );
    try {
      assert.match(auditFile(target).join('\n'), /N\+1/);
    } finally {
      fs.rmSync(target, { force: true });
    }
  }
});

test('detects unbounded findAndCount and query-builder terminals', () => {
  const name = `pagination-audit-${process.pid}-${Date.now()}.ts`;
  const target = fixture(
    `audit-fixtures/infrastructure/persistence/typeorm/repositories/${name}`,
    [
      'repo.findAndCount({ where: { active: true } });',
      "repo.createQueryBuilder('x').where('x.active = 1').getMany();",
    ].join('\n'),
  );
  try {
    const violations = auditFile(target).join('\n');
    assert.match(violations, /sans limite take/);
    assert.match(violations, /query builder de collection sans limite/);
  } finally {
    fs.rmSync(
      path.dirname(
        path.dirname(path.dirname(path.dirname(path.dirname(target)))),
      ),
      {
        recursive: true,
        force: true,
      },
    );
  }
});
