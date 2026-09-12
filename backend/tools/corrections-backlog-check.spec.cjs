const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const backend = path.resolve(__dirname, '..');
const checker = path.join(__dirname, 'corrections-backlog-check.cjs');
const reportNames = [
  'open-debt-register-2026-09-10.md',
  'corrections-lot-100-2026-09-08.md',
  'corrections-lot-100-runtime-room-ws-2026-09-08.md',
  'corrections-lot-100-patterns-caches-jobs-2026-09-08.md',
  'corrections-lot-min100-2026-09-08.json',
  'corrections-lot-100-boundaries-2026-09-08.md',
  'corrections-lot-100-quotas-invariants-2026-09-08.md',
  'corrections-lot-100-engine-contracts-2026-09-10.md',
];

function checkFixture(mutate = () => {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lila-backlog-check-'));
  try {
    fs.mkdirSync(path.join(directory, 'docs/quality'), { recursive: true });
    fs.mkdirSync(path.join(directory, 'logs'));
    fs.copyFileSync(path.join(backend, 'corriger.txt'), path.join(directory, 'corriger.txt'));
    for (const name of reportNames) fs.copyFileSync(path.join(backend, 'docs/quality', name), path.join(directory, 'docs/quality', name));
    mutate(directory);
    return spawnSync(process.execPath, [checker], { cwd: directory, encoding: 'utf8' });
  } finally {
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('current backlog reconciles with lot evidence', () => {
  const result = checkFixture();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).retainedClosed, []);
});
test('accepts multiline JSON snapshot points with Windows line endings', () => {
  const result = checkFixture((directory) => {
    fs.writeFileSync(path.join(directory, 'corriger.txt'),
      'Snapshot JSON complet :\r\n\r\n15. Content modules\r\n\r\n```text\r\ncontent/cards.json\r\n```\r\n');
    fs.writeFileSync(path.join(directory, 'docs/quality/open-debt-register-2026-09-10.md'),
      '| 15 | backend | Content modules | backend/corriger.txt#15 | open | proof documented and removal from corriger.txt |\n');
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).openCount, 1);
});

test('rejects extra backlog content', () => {
  const result = checkFixture((directory) => {
    const file = path.join(directory, 'corriger.txt');
    fs.writeFileSync(file, `Progress header\n${fs.readFileSync(file, 'utf8')}`);
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Backlog must contain only unfinished numbered points/);
});

test('rejects invalid backlog numbering', () => {
  const result = checkFixture((directory) => {
    const file = path.join(directory, 'corriger.txt');
    const source = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, `${source.trim() ? source : '1. placeholder\n'}`.replace(/^\d+\. /m, '9999. '));
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Original backlog IDs must remain ordered/);
});

test('rejects a current point removed without updating its register', () => {
  const result = checkFixture((directory) => {
    fs.writeFileSync(
      path.join(directory, 'corriger.txt'),
      'Snapshot JSON complet :\n\n2. second point\n',
    );
    fs.writeFileSync(
      path.join(directory, 'docs/quality/open-debt-register-2026-09-10.md'),
      '| 1 | backend | first point | backend/corriger.txt#1 | open | proof documented and removal from corriger.txt |\n' +
        '| 2 | backend | second point | backend/corriger.txt#2 | open | proof documented and removal from corriger.txt |\n',
    );
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Register must match corriger.txt exactly/);
});

test('rejects duplicate current point IDs', () => {
  const result = checkFixture((directory) => {
    fs.writeFileSync(
      path.join(directory, 'corriger.txt'),
      'Snapshot JSON complet :\n\n1. first point\n\n1. first point\n',
    );
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Duplicate backlog IDs/);
});
