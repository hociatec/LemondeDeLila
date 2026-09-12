'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { inspectTopLevelMutableState } = require('./game-state-ownership-audit.cjs');

function fixture(source) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'state-ownership-'));
  fs.writeFileSync(path.join(directory, 'fixture.ts'), source);
  return directory;
}

test('rejects process-wide mutable state but permits function-local state', (t) => {
  const directory = fixture('let leaked = 0; function run() { let local = 0; return local; }');
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  assert.deepEqual(inspectTopLevelMutableState(directory, new Set()), [
    'fixture.ts:leaked: top-level let/var',
  ]);
});

test('requires an exact review entry for process-wide collections', (t) => {
  const directory = fixture('const registry = new Map<string, unknown>();');
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  assert.equal(inspectTopLevelMutableState(directory, new Set()).length, 1);
  assert.deepEqual(
    inspectTopLevelMutableState(
      directory,
      new Set(['fixture.ts:registry:Map']),
    ),
    [],
  );
});
