const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const backend = path.resolve(__dirname, '..');
const checker = path.join(__dirname, 'corrections-backlog-check.cjs');
const reportNames = [
  'engine-followup-2026-09-23.md',
  'engine-followup-register-2026-09-23.json',
  'engine-followup-source-2026-09-23.md',
  'engine-audit-register-2026-09-23.json',
  'corriger-2026-09-23.md',
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
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'lila-backlog-check-'),
  );
  try {
    fs.mkdirSync(path.join(directory, 'docs/quality'), { recursive: true });
    fs.mkdirSync(path.join(directory, 'logs'));
    fs.copyFileSync(
      path.join(backend, 'corriger.txt'),
      path.join(directory, 'corriger.txt'),
    );
    for (const name of reportNames)
      fs.copyFileSync(
        path.join(backend, 'docs/quality', name),
        path.join(directory, 'docs/quality', name),
      );
    mutate(directory);
    return spawnSync(process.execPath, [checker], {
      cwd: directory,
      encoding: 'utf8',
    });
  } finally {
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function engineFixture(directory, openIds) {
  const file = path.join(
    directory,
    'docs/quality/engine-audit-register-2026-09-23.json',
  );
  const register = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const point of register.points) {
    point.status = openIds.includes(point.id) ? 'open' : 'closed';
    point.evidence = 'docs/quality/corriger-2026-09-23.md';
  }
  fs.writeFileSync(file, JSON.stringify(register));
  fs.writeFileSync(
    path.join(directory, 'corriger.txt'),
    'J’ai repris l’archive.\n\n## A. Généricité et architecture\n\n' +
      openIds.map((id) => `**${id}. Fixture point**\n`).join('\n'),
  );
}

test('accepts an engine audit with every correction closed', () => {
  const result = checkFixture((directory) => engineFixture(directory, []));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).openCount, 0);
  assert.equal(JSON.parse(result.stdout).documentedClosed, 36);
});

test('accepts a partially completed engine audit', () => {
  const result = checkFixture((directory) => engineFixture(directory, [5, 28]));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).openCount, 2);
});

test('current backlog reconciles with lot evidence', () => {
  const result = checkFixture();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).retainedClosed, []);
});
test('accepts multiline JSON snapshot points with Windows line endings', () => {
  const result = checkFixture((directory) => {
    fs.writeFileSync(
      path.join(directory, 'corriger.txt'),
      'Snapshot JSON complet :\r\n\r\n15. Content modules\r\n\r\n```text\r\ncontent/cards.json\r\n```\r\n',
    );
    fs.writeFileSync(
      path.join(directory, 'docs/quality/open-debt-register-2026-09-10.md'),
      '| 15 | backend | Content modules | backend/corriger.txt#15 | open | proof documented and removal from corriger.txt |\n',
    );
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
  assert.match(
    result.stderr,
    /Backlog must contain only unfinished numbered points/,
  );
});

test('rejects invalid backlog numbering', () => {
  const result = checkFixture((directory) => {
    engineFixture(directory, [5]);
    const file = path.join(directory, 'corriger.txt');
    const source = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(
      file,
      source.replace(/^(\*\*)?\d+\. /m, (_match, bold = '') => `${bold}9999. `),
    );
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

test('rejects an engine audit point removed without its closure record', () => {
  const result = checkFixture((directory) => {
    engineFixture(directory, [5]);
    const file = path.join(directory, 'corriger.txt');
    fs.writeFileSync(
      file,
      fs.readFileSync(file, 'utf8').replace(/^\*\*\d+\. /m, '**Removed. '),
    );
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Register must match corriger.txt exactly/);
});

test('rejects a claimed engine audit closure without evidence', () => {
  const result = checkFixture((directory) => {
    engineFixture(directory, []);
    const file = path.join(
      directory,
      'docs/quality/engine-audit-register-2026-09-23.json',
    );
    const register = JSON.parse(fs.readFileSync(file, 'utf8'));
    delete register.points.find((point) => point.status === 'closed').evidence;
    fs.writeFileSync(file, JSON.stringify(register));
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing closure evidence/);
});
