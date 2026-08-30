'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  auditGameEngineArchitecture,
} = require('./game-engine-architecture-check.cjs');

function fixture(mutator) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lila-game-audit-'));
  const gamesRoot = path.join(root, 'src/game/games/world/example');
  const gameRoot = path.join(root, 'src/game');
  const runtimeRoot = path.join(root, 'src/game/engine/runtime');
  fs.mkdirSync(gamesRoot, { recursive: true });
  fs.mkdirSync(runtimeRoot, { recursive: true });
  fs.mkdirSync(path.join(root, 'src/game/core/application/contracts'), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(gamesRoot, 'manifest.json'),
    JSON.stringify({ code: 'example' }),
  );
  fs.writeFileSync(
    path.join(gamesRoot, 'game.ts'),
    "export default defineGame({ id: 'example' });\n",
  );
  fs.writeFileSync(
    path.join(gamesRoot, 'state.ts'),
    'export type State = {};\n',
  );
  fs.writeFileSync(
    path.join(gamesRoot, 'rules.ts'),
    'export const pass = 1;\n',
  );
  fs.writeFileSync(
    path.join(gamesRoot, 'content.ts'),
    'export const content = [];\n',
  );
  fs.writeFileSync(path.join(gamesRoot, 'game.spec.ts'), 'testGame(game);\n');
  fs.writeFileSync(
    path.join(
      root,
      'src/game/core/application/contracts/game-runtime.interface.ts',
    ),
    [
      'interface Runtime {',
      'hydrateInitialState(): void; validateActor(): void; validateAction(): void;',
      'applyActions(): void; getAvailableActions(): void; exposeStateForUser(): void;',
      'getBotActions(): void; getAutomaticActions(): void; getShortcuts(): void;',
      'getDescriptor(): void;',
      '}',
    ].join('\n'),
  );
  try {
    mutator?.({ root, gamesRoot, gameRoot, runtimeRoot });
    return auditGameEngineArchitecture({
      gamesRoot,
      gameRoot,
      runtimeRoot,
      skipCli: true,
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('accepts a minimal framework-free declarative game', () => {
  assert.deepEqual(fixture(), []);
});

test('rejects framework layers, nondeterminism and unsafe types', () => {
  const violations = fixture(({ gamesRoot }) => {
    const services = path.join(gamesRoot, 'application/services');
    fs.mkdirSync(services, { recursive: true });
    fs.writeFileSync(
      path.join(services, 'example.service.ts'),
      "import { Injectable } from '@nestjs/common'; const value: any = Math.random();\n",
    );
  });
  const rules = new Set(violations.map((violation) => violation.rule));
  assert.equal(rules.has('no-framework-layer-per-game'), true);
  assert.equal(rules.has('no-framework-file-per-game'), true);
  assert.equal(rules.has('framework-free-games'), true);
  assert.equal(rules.has('deterministic-rules'), true);
  assert.equal(rules.has('no-any'), true);
});

test('rejects untyped game errors and whole-state player projections', () => {
  const violations = fixture(({ gamesRoot }) => {
    fs.writeFileSync(
      path.join(gamesRoot, 'rules.ts'),
      "throw new Error('invalid move'); ctx.history.add('played');\n",
    );
    fs.writeFileSync(
      path.join(gamesRoot, 'game.ts'),
      "export default defineGame({ id: 'example', view: ({ state }) => structuredClone(state) });\n",
    );
  });
  const rules = new Set(violations.map((violation) => violation.rule));
  assert.equal(rules.has('typed-game-errors'), true);
  assert.equal(rules.has('explicit-player-projection'), true);
  assert.equal(rules.has('structured-game-events'), true);
});

test('rejects legacy action input discovery used as validation', () => {
  const violations = fixture(({ gamesRoot }) => {
    fs.writeFileSync(
      path.join(gamesRoot, 'rules.ts'),
      'export const action = { availableInputs: () => [] };\n',
    );
  });
  assert.equal(
    violations.some(
      (violation) => violation.rule === 'separate-action-validation',
    ),
    true,
  );
});

test('rejects direct runtime imports and enforces the stable author SDK', () => {
  const violations = fixture(({ gamesRoot }) => {
    fs.writeFileSync(
      path.join(gamesRoot, 'rules.ts'),
      "import { GameContext } from '../../../engine/runtime/game-rule-context';\n",
    );
  });
  assert.equal(
    violations.some((violation) => violation.rule === 'game-sdk-boundary'),
    true,
  );
});

test('rejects missing standard files and manifest/definition drift', () => {
  const violations = fixture(({ gamesRoot }) => {
    fs.rmSync(path.join(gamesRoot, 'content.ts'));
    fs.writeFileSync(
      path.join(gamesRoot, 'game.ts'),
      "export default defineGame({ id: 'other' });\n",
    );
  });
  const rules = new Set(violations.map((violation) => violation.rule));
  assert.equal(rules.has('standard-entry-files'), true);
  assert.equal(rules.has('manifest-definition-id'), true);
});

test('rejects duplicate entry points and old per-game file generations', () => {
  const violations = fixture(({ gamesRoot }) => {
    const nested = path.join(gamesRoot, 'nested');
    fs.mkdirSync(nested);
    fs.writeFileSync(
      path.join(nested, 'game.ts'),
      "export default defineGame({ id: 'nested' });\n",
    );
    for (const file of [
      'example.runtime.ts',
      'example.shortcuts.ts',
      'example.pawns.ts',
      'game.definition.ts',
    ]) {
      fs.writeFileSync(path.join(gamesRoot, file), 'export {};\n');
    }
  });
  const rules = new Set(violations.map((violation) => violation.rule));
  assert.equal(rules.has('exact-game-entry-discovery'), true);
  assert.equal(rules.has('no-framework-file-per-game'), true);
});

test('rejects oversized files, unsafe casts and legacy runtime symbols', () => {
  const violations = fixture(({ gamesRoot, runtimeRoot }) => {
    fs.writeFileSync(
      path.join(gamesRoot, 'rules.ts'),
      [
        'declare const metadata: unknown;',
        'declare const GameRulebook: unknown;',
        'type State = { value: number };',
        'const first = metadata as State;',
        'const second = metadata as unknown as State;',
        'void GameRulebook; void first; void second;',
        ...Array.from({ length: 550 }, () => '// rule'),
      ].join('\n'),
    );
    fs.writeFileSync(
      path.join(runtimeRoot, 'oversized.ts'),
      Array.from({ length: 501 }, () => '// runtime').join('\n'),
    );
  });
  const rules = new Set(violations.map((violation) => violation.rule));
  assert.equal(rules.has('game-file-size'), true);
  assert.equal(rules.has('runtime-file-size'), true);
  assert.equal(rules.has('no-double-cast'), true);
  assert.equal(rules.has('typed-engine-state'), true);
  assert.equal(rules.has('single-runtime-api'), true);
});

test('rejects an incomplete official runtime contract', () => {
  const violations = fixture(({ root }) => {
    const contract = path.join(
      root,
      'src/game/core/application/contracts/game-runtime.interface.ts',
    );
    fs.writeFileSync(
      contract,
      'interface Runtime { hydrateInitialState(): void }',
    );
  });
  const missing = violations.filter(
    (violation) => violation.rule === 'complete-runtime-contract',
  );
  assert.equal(missing.length, 9);
});
