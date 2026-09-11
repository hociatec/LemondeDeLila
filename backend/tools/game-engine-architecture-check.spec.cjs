'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  auditGameEngineArchitecture,
  auditSdkPublicSurface,
  SDK_PUBLIC_SURFACE,
} = require('./game-engine-architecture-check.cjs');

function fixture(mutator) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lila-game-audit-'));
  const gamesRoot = path.join(root, 'src/game/games/world/example');
  const gameRoot = path.join(root, 'src/game');
  const runtimeRoot = path.join(root, 'src/game/engine/runtime');
  fs.mkdirSync(gamesRoot, { recursive: true });
  fs.mkdirSync(runtimeRoot, { recursive: true });
  fs.mkdirSync(path.join(root, 'src/game/core/application/ports'), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(gamesRoot, 'manifest.json'),
    JSON.stringify({ code: 'example' }),
  );
  fs.writeFileSync(
    path.join(gamesRoot, 'game.ts'),
    "import manifest from './manifest.json';\nexport default defineGame({ id: manifest.code, displayName: manifest.name, description: manifest.summary, players: { min: manifest.minPlayers, max: manifest.maxPlayers } });\n",
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
      'src/game/core/application/ports/game-runtime.port.ts',
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

test('accepts a data-only game package and rejects parallel executable sources', () => {
  const jsonPackage = ({ gamesRoot }) => {
    for (const file of ['game.ts', 'state.ts', 'rules.ts', 'content.ts', 'game.spec.ts']) {
      fs.unlinkSync(path.join(gamesRoot, file));
    }
    fs.writeFileSync(path.join(gamesRoot, 'game.json'), '{"schemaVersion":1}');
    fs.writeFileSync(path.join(gamesRoot, 'rules.md'), '# Rules');
  };
  assert.deepEqual(fixture(jsonPackage), []);
  assert(fixture(paths => {
    jsonPackage(paths);
    fs.writeFileSync(path.join(paths.gamesRoot, 'rules.ts'), 'export const hidden = 1;');
  }).some(item => item.rule === 'json-game-no-executable-source'));
});

test('accepts a minimal framework-free declarative game', () => {
  assert.deepEqual(fixture(), []);
});

test('rejects external work and deferred callbacks from rule modules, including aliases', () => {
  for (const source of [
    "export const play = () => fetch('/write', { method: 'POST' });",
    "const send = fetch; export const play = () => send('/write');",
    "const { fetch: send } = globalThis; export const play = () => send('/write');",
    "export const play = () => globalThis['fetch']('/write');",
    "export const play = () => setTimeout(() => {}, 1);",
    "export const play = () => queueMicrotask(() => {});",
    "export const play = () => Promise.resolve().then(() => {});",
    "export const play = async () => {};",
  ]) {
    const violations = fixture(({ gamesRoot }) => fs.writeFileSync(path.join(gamesRoot, 'rules.ts'), source));
    assert(violations.some((item) => item.rule === 'no-external-game-effects'), source);
  }
});

test('does not mistake content strings or ordinary properties for external capabilities', () => {
  const violations = fixture(({ gamesRoot }) => fs.writeFileSync(path.join(gamesRoot, 'rules.ts'), "export const text = 'fetch and setTimeout'; export const data = { fetch: 'card' }; export const play = ctx => ctx.cards.fetch();"));
  assert(!violations.some((item) => item.rule === 'no-external-game-effects'));
  assert(!fixture(({ gamesRoot }) => fs.writeFileSync(path.join(gamesRoot, 'rules.ts'), "import { self } from '../../../engine/sdk/public-api'; export const target = self;")).some((item) => item.rule === 'no-external-game-effects'));
  assert(!fixture(({ gamesRoot }) => fs.writeFileSync(path.join(gamesRoot, 'rules.ts'), "const self = { kind: 'self' }; export const target = self;")).some((item) => item.rule === 'no-external-game-effects'));
  assert(!fixture(({ gamesRoot }) => fs.writeFileSync(path.join(gamesRoot, 'game.spec.ts'), 'testGame(game); test("integration", async () => { await Promise.resolve(); });')).some((item) => item.rule === 'no-external-game-effects'));
});

test('rejects prose interpreters in game rules and content helpers', () => {
  for (const source of [
    "export const effect = card.text.match(/avancez (\\d+)/);",
    "export const skip = /passez/.test(card.description);",
    "export const group = tile.title.normalize('NFD');",
  ]) {
    const violations = fixture(({ gamesRoot }) => {
      fs.writeFileSync(path.join(gamesRoot, 'content-helper.ts'), source);
    });
    assert(violations.some(violation => violation.rule === 'structured-game-content'));
  }
});

test('accepts explicit data and presentation-only formatting', () => {
  assert.deepEqual(fixture(({ gamesRoot }) => {
    fs.writeFileSync(path.join(gamesRoot, 'content-helper.ts'),
      "export const effects = card.effects; export const label = id.replace(/-/g, ' ');");
  }), []);
});

test('rejects a second game-folder discovery outside composition', () => {
  const violations = fixture(({ gameRoot }) => {
    fs.writeFileSync(path.join(gameRoot, 'core/application/ports/catalogue.ts'), "export const entries = fs.readdirSync('games');\n");
  });
  assert(violations.some(violation => violation.rule === 'composition-game-discovery'));
});

test('rejects duplicated metadata even when its literal currently matches the manifest', () => {
  const violations = fixture(({ gamesRoot }) => {
    const file = path.join(gamesRoot, 'game.ts');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('displayName: manifest.name', "displayName: 'Example'"));
  });
  assert(violations.some(violation => violation.rule === 'canonical-manifest-metadata'));
});

test('rejects all external imports, including side effects, require and dynamic import', () => {
  for (const source of [
    "import 'node:fs';",
    "const fs = require('fs');",
    "import('node:path');",
    "import { x } from 'typeorm';",
    "import { x } from 'ioredis';",
    "import { x } from 'bullmq';",
    "import { x } from '../../../core/testing/game-test-kit';",
    "import { testGame } from '../../../engine/testing/public-api';",
    "import { compileJsonGame } from '../../../engine/json/public-api';",
    'process.cwd();',
    '__dirname;',
    'fetch(url);',
  ]) {
    const violations = fixture(({ gamesRoot }) =>
      fs.writeFileSync(path.join(gamesRoot, 'content.ts'), source),
    );
    assert.ok(
      violations.some((v) => v.rule === 'game-sdk-boundary'),
      source,
    );
  }
});

test('rejects local cycles including type-only imports', () => {
  const violations = fixture(({ gamesRoot }) => {
    fs.writeFileSync(
      path.join(gamesRoot, 'content.ts'),
      "import type { A } from './types'; export type B = A;",
    );
    fs.writeFileSync(
      path.join(gamesRoot, 'types.ts'),
      "import type { B } from './content'; export type A = B;",
    );
  });
  assert.ok(violations.some((v) => v.rule === 'acyclic-game-files'));
});

test('permits testing facade only in specs', () => {
  assert.deepEqual(
    fixture(({ gamesRoot }) => {
      fs.writeFileSync(
        path.join(gamesRoot, 'game.spec.ts'),
        "import { testGame } from '../../../engine/testing/public-api'; import { compileJsonGame } from '../../../engine/json/public-api'; testGame(game);",
      );
    }),
    [],
  );
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

test('requires defineCardsSchema for direct card-kit declarations', () => {
  const violations = fixture(({ gamesRoot }) => {
    fs.writeFileSync(
      path.join(gamesRoot, 'game.ts'),
      "export default defineGame({ id: 'example', components: [cards.deck({ id: 'main', cards: [] })] });\n",
    );
  });
  assert.equal(
    violations.some((violation) => violation.rule === 'typed-card-schema'),
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
      'src/game/core/application/ports/game-runtime.port.ts',
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

test('locks the complete public SDK surface, including type exports', () => {
  assert.deepEqual(auditSdkPublicSurface(), []);
  assert.equal(
    auditSdkPublicSurface({
      ...SDK_PUBLIC_SURFACE,
      exportCount: SDK_PUBLIC_SURFACE.exportCount - 1,
    })[0].rule,
    'sdk-public-surface',
  );
});

test('rejects game-specific throw representations', () => {
  const { inspectGameImports } = require('./game-import-boundaries.cjs');
  const file = path.resolve('fixture/game/rules.ts');
  const result = inspectGameImports(
    file,
    'throw new Error("custom representation");',
    path.dirname(file),
  );
  assert.equal(
    result.violations.some((message) => message.includes('rejectRule')),
    true,
  );
  assert.deepEqual(
    inspectGameImports(file, 'rejectRule("unavailable");', path.dirname(file))
      .violations,
    [],
  );
});

test('enforces dependency direction through type imports, barrels and helpers', () => {
  for (const files of [
    { 'types.ts': "import type { Card } from './content';" },
    { 'constants.ts': "export * from './rules';" },
    { 'content.ts': "import './bridge';", 'bridge.ts': "export * from './rules';" },
    { 'content-schema.ts': "type Rule = import('./rules').Rule;" },
    { 'rules.ts': "import './game';" },
    { 'content.ts': "const rules = require('./bridge');", 'bridge.ts': "import './actions';", 'actions.ts': 'export {};' },
  ]) {
    const violations = fixture(({ gamesRoot }) => {
      for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(gamesRoot, name), body);
    });
    assert(violations.some(value => value.rule === 'game-dependency-direction'), JSON.stringify(files));
  }
});

test('accepts types then constants then content then rules then composition', () => {
  const violations = fixture(({ gamesRoot }) => {
    fs.writeFileSync(path.join(gamesRoot, 'types.ts'), 'export type Card = { id: string };');
    fs.writeFileSync(path.join(gamesRoot, 'constants.ts'), "import type { Card } from './types'; export const card: Card = { id: 'one' };");
    fs.appendFileSync(path.join(gamesRoot, 'content.ts'), "\nimport { card } from './constants'; void card;");
    fs.appendFileSync(path.join(gamesRoot, 'rules.ts'), "\nimport './content';");
    fs.appendFileSync(path.join(gamesRoot, 'game.ts'), "\nimport './rules';");
  });
  assert.deepEqual(violations, []);
});

test('keeps exported data contracts outside rules', () => {
  for (const source of [
    'export type Move = { roll: number };',
    'export interface Move { roll: number }',
    "export type { Move } from './types';",
    "export { type Move } from './types';",
    'type Move = { roll: number }; export { Move as PendingMove };',
    "import type { Move } from './types'; export { Move };",
  ]) {
    const violations = fixture(({ gamesRoot }) => {
      fs.appendFileSync(path.join(gamesRoot, 'rules.ts'), '\n' + source);
    });
    assert(violations.some(value => value.rule === 'game-rule-contracts'), source);
  }
  const { inspectRuleContracts } = require('./game-composition-boundary.cjs');
  assert.deepEqual(inspectRuleContracts('rules.ts', "import type { Move } from './types'; type Context = GameContext; export const move = defineAction({});"), []);
});

test('keeps executable decisions out of game composition', () => {
  const { inspectGameComposition } = require('./game-composition-boundary.cjs');
  for (const source of [
    'const setup = ({ ctx }) => { ctx.round.start(1); return {}; };',
    'const choose = ({ actor }) => actor.id === 1 ? first : second;',
    'const execute = ({ ctx: game }) => game.turn.complete();',
    "import { defineAction as action } from '../../../engine/sdk/public-api'; const rule = action({});",
  ]) assert(inspectGameComposition('game.ts', source).length > 0, source);
  assert.deepEqual(inspectGameComposition('game.ts', "import { drawAtTurnStart } from './rules'; const options = { draw: ({ ctx }) => drawAtTurnStart(ctx) }; const metadata = cards.map(card => card.id); const bot = { choose: () => ({ type: 'roll' }) };"), []);
});
