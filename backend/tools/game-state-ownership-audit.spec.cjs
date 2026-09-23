'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  inspectTopLevelMutableState,
  inspectWriteCapabilities,
} = require('./game-state-ownership-audit.cjs');

function fixture(source) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'state-ownership-'));
  fs.writeFileSync(path.join(directory, 'fixture.ts'), source);
  return directory;
}

test('only controller composition receives the writable component store', () => {
  assert.deepEqual(inspectWriteCapabilities(), []);
});

test('rejects importing, aliasing or re-exporting the storage write capability', (t) => {
  for (const source of [
    "import type { MutableEngineKitsState as Write } from './declarative-state';",
    "export type { MutableEngineKitsState } from './declarative-state';",
    "type Write = import('./declarative-state').MutableEngineKitsState;",
  ]) {
    const directory = fixture(source);
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    assert.equal(inspectWriteCapabilities(directory).length, 1);
  }
});

test('rejects process-wide mutable state but permits function-local state', (t) => {
  const directory = fixture(
    'let leaked = 0; function run() { let local = 0; return local; }',
  );
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
