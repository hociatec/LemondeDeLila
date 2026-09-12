import { compileJsonGame } from './json-game-compiler';
import { DeclarativeGameRuntime } from '../declarative-game.runtime';
import {
  FixedGameClock,
  StateGameRng,
} from '../../../core/application/models/game-execution-context.model';
import type { GameState } from '../../../core/application/models/game-state.model';

import manifest from '../../../testing/fixtures/json-course/manifest.json';
import document from '../../../testing/fixtures/json-course/game.json';
import standardManifest from '../../../games/vents-sacres/course-des-etoiles/manifest.json';
import standardDocument from '../../../games/vents-sacres/course-des-etoiles/game.json';
import { discoverGameDefinitions } from '../../../composition/game-module-discovery';

it.each(['all-qualified', 'unique-qualified', 'highest-value-lowest-id'])(
  'compiles the explicit JSON threshold selection policy %s',
  (selection) => {
    expect(() =>
      compileJsonGame(manifest, {
        ...document,
        victory: {
          kind: 'score-at-least',
          amount: 10,
          participants: 'all',
          selection,
          reason: 'threshold',
        },
      }),
    ).not.toThrow();
  },
);

it('rejects an unknown threshold winner policy before runtime', () => {
  expect(() =>
    compileJsonGame(manifest, {
      ...document,
      victory: {
        kind: 'score-at-least',
        amount: 10,
        selection: 'random-implicitly',
      },
    }),
  ).toThrow();
});

function baseState(): GameState {
  return {
    version: 1,
    status: 'started',
    phase: 'setup',
    log: [],
    players: [
      { id: 1, username: 'Alice' },
      { id: 2, username: 'Bob' },
    ],
    metadata: { rng: { seed: 42, counter: 0 } },
  };
}

it('runs a minimal board without collection, cards, quiz, exchange or pawns', () => {
  const definition = compileJsonGame(manifest, {
    ...document,
    setup: {},
    resourceIds: [],
    initialPhase: 'playing',
    phases: { playing: { actions: ['roll'], terminal: true } },
    components: [
      {
        component: 'movement.track',
        id: 'path',
        spaces: 2,
        overshoot: 'clamp',
      },
      { component: 'dice.set', id: 'die', count: 1, sides: 6 },
    ],
    actions: { roll: { recipe: 'board-roll' } },
    victory: { kind: 'by-board' },
    board: {
      namespace: 'minimal',
      trackId: 'path',
      diceId: 'die',
      playingPhase: 'playing',
      startingPlayer: 'first',
      maxDepth: 4,
      bindings: {},
      tiles: [
        { id: 'start', label: 'Start', description: '', operations: [] },
        {
          id: 'end',
          label: 'Finish',
          description: '',
          operations: [{ kind: 'finish', reason: 'arrived' }],
        },
      ],
    },
  });
  const runtime = new DeclarativeGameRuntime(definition);
  const initial = runtime.hydrateInitialState(baseState());
  const action = runtime.validateAction(
    initial,
    { type: 'roll', payload: {} },
    1,
  );
  const finished = runtime.applyActions(initial, [action], {
    actorId: 1,
    clock: new FixedGameClock(1000),
    rng: new StateGameRng(initial),
  });
  expect(finished.status).toBe('finished');
  expect(finished).toHaveProperty('engine.kits.movement.positions.path.1', 1);
});

it('compiles JSON patterns through the same engine primitives and validates their references', () => {
  const source = {
    ...document,
    components: document.components.filter(
      (component) => component.component !== 'movement.track',
    ),
    patterns: [
      { kind: 'race', trackId: 'board', spaces: 8, diceId: 'pattern-dice' },
    ],
  };
  const definition = compileJsonGame(manifest, source);
  const runtime = new DeclarativeGameRuntime(definition);
  expect(runtime.hydrateInitialState(baseState())).toHaveProperty(
    'engine.kits.movement.positions.board.1',
    0,
  );
  expect(() =>
    compileJsonGame(manifest, {
      ...source,
      patterns: [
        {
          ...source.patterns[0],
          landingEffects: {
            0: [{ kind: 'move', trackId: 'unknown', spaces: 1 }],
          },
        },
      ],
    }),
  ).toThrow(/unknown/);
});

it.each(
  [
    [{ kind: 'unknown' }],
    [{ kind: 'race', trackId: 'race', spaces: 0 }],
    [{ kind: 'race', trackId: 'race', spaces: 8, execute: 'arbitrary code' }],
    [
      { kind: 'race', trackId: 'race', spaces: 8 },
      { kind: 'race', trackId: 'race', spaces: 8 },
    ],
  ].map((patterns) => ({ patterns })),
)('rejects malformed or duplicate JSON patterns %j', ({ patterns }) => {
  expect(() => compileJsonGame(manifest, { ...document, patterns })).toThrow();
});

it.each([
  { ...manifest, engine: 'different' },
  { ...manifest, code: '', engine: '' },
  { ...manifest, name: '' },
  { ...manifest, minPlayers: 0 },
  { ...manifest, maxPlayers: 100 },
])(
  'rejects invalid manifest metadata during JSON compilation: %j',
  (invalid) => {
    expect(() => compileJsonGame(invalid, document)).toThrow();
  },
);

it('discovers and plays the installed JSON-only standard game through the official registry', () => {
  const definition = discoverGameDefinitions().find(
    (game) => game.id === standardManifest.code,
  );
  expect(definition).toBeDefined();
  if (!definition) throw new Error('Standard JSON game missing');
  expect(definition.plan).toEqual(
    compileJsonGame(standardManifest, standardDocument).plan,
  );
  const runtime = new DeclarativeGameRuntime(definition);
  let state = runtime.hydrateInitialState(baseState());
  for (const actorId of [1, 2, 1, 2, 1]) {
    const action = runtime.validateAction(
      state,
      { type: 'avancer', payload: {} },
      actorId,
    );
    state = runtime.applyActions(state, [action], {
      actorId,
      clock: new FixedGameClock(1000),
      rng: new StateGameRng(state),
    });
  }
  expect(state.status).toBe('finished');
  expect(state).toHaveProperty('engine.kits.movement.positions.course.1', 3);
  expect(runtime.getAvailableActions(state, 1)).toEqual([]);
});

it.each([
  { kind: 'draw-cards', deckId: 'absent', handId: 'hand', count: 1 },
  { kind: 'roll-dice', diceId: 'absent' },
  { kind: 'move', trackId: 'absent', spaces: 1 },
  { kind: 'gain-resource', resource: 'absent', amount: 1 },
  { kind: 'custom', effectId: 'absent' },
  { kind: 'discard-random-inventory', inventoryId: 'absent', count: 1 },
  {
    kind: 'conditional',
    condition: { kind: 'has-resource', resource: 'absent', amount: 1 },
    then: [{ kind: 'gain-score', amount: 1 }],
  },
])('validates references inside card content before runtime: %j', (effect) => {
  const source = {
    ...document,
    components: document.components.map((component) =>
      component.component === 'cards.deck'
        ? { ...component, cards: [{ id: 'bad-card', effects: [effect] }] }
        : component,
    ),
  };
  expect(() => compileJsonGame(manifest, source)).toThrow(
    /components\..*\.cards\.0\.effects/,
  );
});

it('does not conflate a numeric card value with a string identifier', () => {
  const source = {
    ...document,
    components: document.components.map((component) =>
      component.component === 'cards.deck'
        ? { ...component, cards: [1, 2, 3, 4] }
        : component,
    ),
    actions: {
      advance: {
        effects: [
          {
            kind: 'conditional',
            condition: { kind: 'has-card', handId: 'hand', cardId: '1' },
            then: [{ kind: 'gain-score', amount: 1 }],
          },
        ],
      },
    },
  };
  expect(() => compileJsonGame(manifest, source)).toThrow(/carte inconnue/);
});

it.each([
  { kind: 'resources', owner: { kind: 'self' } },
  { kind: 'cards', handId: 'hand', owner: { kind: 'self' } },
])('rejects undeclared reaction option references for %j', (availability) => {
  const source = {
    ...document,
    actions: {
      advance: {
        effects: [
          {
            kind: 'reaction',
            reactor: { kind: 'self' },
            availability,
            options: ['missing'],
            reactions: { missing: [] },
          },
        ],
      },
    },
  };
  expect(() => compileJsonGame(manifest, source)).toThrow(/options\.0/);
});

it('executes an entire JSON-authored game with dealing, placement, resources, turns and victory', () => {
  const definition = compileJsonGame(
    manifest,
    JSON.parse(JSON.stringify(document)),
  );
  const runtime = new DeclarativeGameRuntime(definition);
  let state = runtime.hydrateInitialState(baseState());
  expect(state).toHaveProperty('engine.kits.cards.hands.hand.1.length', 1);
  expect(state).toHaveProperty('engine.kits.movement.positions.board.1', 0);
  for (const actorId of [1, 2, 1, 2, 1]) {
    expect(state.turn?.currentPlayerId).toBe(actorId);
    const action = runtime.validateAction(
      state,
      { type: 'advance', payload: {} },
      actorId,
    );
    state = runtime.applyActions(state, [action], {
      actorId,
      clock: new FixedGameClock(1000),
      rng: new StateGameRng(state),
    });
  }
  expect(state.status).toBe('finished');
  expect(state).toHaveProperty('engine.kits.movement.positions.board.1', 3);
  expect(runtime.getAvailableActions(state, 1)).toEqual([]);
});

it.each([
  { ...document, schemaVersion: 2 },
  { ...document, actions: { advance: { execute: 'ctx.turn.end()' } } },
  {
    ...document,
    actions: { advance: { effects: [{ kind: 'gain-score', amount: '1' }] } },
  },
  { ...document, resourceIds: [] },
  { ...document, resourceIds: ['stars', 'stars'] },
  { ...document, components: [] },
  { ...document, initialPhase: 'absent' },
  {
    ...document,
    phases: { playing: { terminal: true, actions: ['missing'] } },
  },
  { ...document, phases: { playing: { actions: ['advance'] } } },
  {
    ...document,
    phases: {
      playing: {
        terminal: true,
        actions: ['advance'],
        transitions: ['playing'],
      },
    },
  },
  { ...document, components: [...document.components, document.components[0]] },
  {
    ...document,
    actions: {
      advance: { effects: [{ kind: 'custom', effectId: 'execute-code' }] },
    },
  },
  {
    ...document,
    actions: {
      advance: {
        effects: [
          {
            kind: 'discard-random-inventory',
            inventoryId: 'missing',
            count: 1,
          },
        ],
      },
    },
  },
])(
  'rejects invalid documents and unavailable mechanics before creating runtime',
  (invalid) => {
    expect(() => compileJsonGame(manifest, invalid)).toThrow();
  },
);

it('captures immutable rules and refuses old snapshots when JSON changes without a version bump', () => {
  const source = structuredClone(document);
  const original = compileJsonGame(manifest, source);
  const snapshot = new DeclarativeGameRuntime(original).hydrateInitialState(
    baseState(),
  );
  source.victory.amount = 50;
  expect(original.content.data).toMatchObject({ victory: { amount: 3 } });
  expect(Object.isFrozen(original.content.data)).toBe(true);
  const changed = compileJsonGame(manifest, source);
  expect(changed.rulesVersion).toBe(original.rulesVersion);
  expect(changed.contentVersion).toBe(original.contentVersion);
  expect(changed.contentDigest).not.toBe(original.contentDigest);
  expect(() =>
    new DeclarativeGameRuntime(changed).getAvailableActions(snapshot, 1),
  ).toThrow(/incompatible/);
});
