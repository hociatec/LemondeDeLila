const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  analyzeStructure,
  compareWithBaseline,
  summarizeByRule,
} = require('./structural-quality-check.cjs');

const contract = {
  schemaVersion: 1,
  limits: {
    fileLines: 12,
    classLines: 9,
    methodLines: 4,
    methodsPerClass: 2,
    constructorDependencies: 2,
  },
  ignoredSuffixes: ['.spec.ts', '.d.ts'],
  ignoredPathFragments: ['/migrations/'],
  constructorDependencyExemptions: ['\\.registrar\\.ts$'],
};

function withFixture(files, callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lila-structure-'));
  try {
    for (const [relative, content] of Object.entries(files)) {
      const filePath = path.join(root, relative);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, 'utf8');
    }
    return callback(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('detects oversized files, classes, methods and dependency lists', () => {
  withFixture(
    {
      'large.service.ts': [
        'export class LargeService {',
        '  constructor(a: unknown, b: unknown, c: unknown) {}',
        '  first() {',
        '    const a = 1;',
        '    const b = 2;',
        '    return a + b;',
        '  }',
        '  second() {}',
        '  third() {}',
        '}',
        '',
        '',
        '',
      ].join('\n'),
    },
    (root) => {
      const analysis = analyzeStructure({ root, contract });
      assert.deepEqual(summarizeByRule(analysis.violations), {
        'class-lines': 1,
        'constructor-dependencies': 1,
        'file-lines': 1,
        'method-lines': 1,
        'methods-per-class': 1,
      });
    },
  );
});

test('ignores tests, migrations and registrar constructor fan-in', () => {
  withFixture(
    {
      'ignored.spec.ts': 'x\n'.repeat(20),
      'migrations/001.ts': 'x\n'.repeat(20),
      'plugin.registrar.ts': [
        'export class PluginRegistrar {',
        '  constructor(a: unknown, b: unknown, c: unknown) {}',
        '}',
      ].join('\n'),
    },
    (root) => {
      const analysis = analyzeStructure({ root, contract });
      assert.equal(analysis.violations.length, 0);
    },
  );
});

test('detects oversized standalone functions', () => {
  withFixture(
    {
      'large.helper.ts': [
        'export function oversized() {',
        '  const a = 1;',
        '  const b = 2;',
        '  const c = 3;',
        '  return a + b + c;',
        '}',
      ].join('\n'),
    },
    (root) => {
      const analysis = analyzeStructure({ root, contract });
      assert.deepEqual(summarizeByRule(analysis.violations), {
        'function-lines': 1,
      });
    },
  );
});

test('rejects new debt and increases while allowing reductions', () => {
  const existing = {
    rule: 'file-lines',
    file: 'old.ts',
    subject: null,
    line: 1,
    actual: 20,
    limit: 12,
  };
  const baseline = { violations: [existing] };
  assert.equal(
    compareWithBaseline([{ ...existing, actual: 19 }], baseline).length,
    0,
  );
  assert.equal(
    compareWithBaseline([{ ...existing, actual: 21 }], baseline).length,
    1,
  );
  assert.equal(
    compareWithBaseline(
      [{ ...existing, file: 'new.ts', actual: 13 }],
      baseline,
    ).length,
    1,
  );
});
