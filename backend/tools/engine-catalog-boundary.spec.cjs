'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { auditEngineBoundary } = require('./engine-catalog-boundary.cjs');

test('the engine has no direct or transitive dependency on rules, games or composition', () => {
  const report = auditEngineBoundary(path.join(__dirname, '../src'));
  assert(report.engineFiles > 100);
  assert.deepEqual(report.violations, []);
  assert.deepEqual(report.gameReferences, []);
});

test('rejects indirect catalogue imports, including types and aliases', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lila-catalog-boundary-'));
  const put = (file, body) => {
    const target = path.join(directory, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
  };
  try {
    put('tsconfig.json', JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@rules/*': ['game/rules/*'] }, resolveJsonModule: true } }));
    put('game/engine/core.ts', "import type { Rule } from '../shared/barrel';");
    put('game/shared/barrel.ts', "export type { Rule } from '@rules/catalog';");
    put('game/rules/catalog.ts', 'export type Rule = string;');
    assert.deepEqual(auditEngineBoundary(directory).violations, [[
      'game/engine/core.ts', 'game/shared/barrel.ts', 'game/rules/catalog.ts',
    ]]);
    for (const source of ["import('../rules/catalog');", "require('../rules/catalog');", "import Rules = require('../rules/catalog');"]) {
      put('game/engine/core.ts', source);
      assert.equal(auditEngineBoundary(directory).violations.length, 1);
    }
    put('game/engine/core.ts', 'export const engine = true;');
    put('game/rules/catalog.ts', "import { engine } from '../engine/core';");
    assert.deepEqual(auditEngineBoundary(directory).violations, []);
    put('game/games/example/manifest.json', JSON.stringify({ code: 'example-game' }));
    put('game/engine/core.ts', "export const selected = 'example-game';");
    assert.equal(auditEngineBoundary(directory).gameReferences.length, 1);
    put('game/engine/core.ts', "export const path = 'src/game/games/example/content.json';");
    assert.equal(auditEngineBoundary(directory).gameReferences.length, 1);
  } finally {
    // The absolute directory was created by this test beneath the system temp root.
    assert(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
