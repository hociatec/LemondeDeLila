import { defineGame } from './game-definition';
import { defineAction } from './game-definition-builders';
import { gameInput } from '../actions/game-input-schema';
import { assertCompiledGameDefinition } from './compiled-game-definition-brand';
import { when } from '../automation/automatic-kit';
import { movement } from '../kits/movement-kit';
import { GAME_CONTENT_KIND } from '../content/game-content';
import { describeGameDefinition } from './runtime-descriptor';
import { DeclarativeGameRuntime } from '../declarative-game.runtime';
import { overrideAction } from '../actions/action-builders';
import { overrideComponent, type GameInitialization } from './component-kit';

function author() {
  return {
    id: 'compilation-contract',
    displayName: 'Compilation',
    category: 'test',
    players: { min: 1, max: 2 },
    actions: {
      pass: defineAction({ input: gameInput.object({}), execute: () => {} }),
    },
  };
}

it.each<GameInitialization>([
  { scores: NaN },
  { scores: { 1: Infinity } },
  { scores: { '01': 1 } },
  { resources: { coins: Number.MAX_SAFE_INTEGER + 1 } },
  { resources: { coins: { 0: 1 } } },
  { counters: { laps: Infinity } },
  { counters: { toString: 1 } },
])('rejects invalid initial values before runtime: %j', (initialization) => {
  expect(() => defineGame<object>()({ ...author(), initialization })).toThrow(
    'initialization',
  );
});

it('accepts signed player identifiers and bounded fractional balances', () => {
  expect(() =>
    defineGame<object>()({
      ...author(),
      initialization: {
        scores: { '-1': -2.5, 1: 0 },
        resources: { coins: -0.5 },
        counters: { laps: -1 },
      },
    }),
  ).not.toThrow();
});

it.each(['toString', 'valueOf', 'x'.repeat(129)])(
  'rejects resource identifiers that the runtime cannot use: %s',
  (id) => {
    expect(() =>
      defineGame<object>()({ ...author(), resourceIds: [id] }),
    ).toThrow('resourceIds');
  },
);

it('rejects dangling or mismatched overrides before composition erases their targets', () => {
  const action = author().actions.pass;
  expect(() =>
    defineGame<object>()({
      ...author(),
      actions: { pass: overrideAction('pass', action) },
    }),
  ).toThrow('remplacement');
  const track = movement.track({ id: 'road', spaces: 10 });
  expect(() =>
    defineGame<object>()({
      ...author(),
      components: [overrideComponent(track)],
    }),
  ).toThrow('remplacement');
  expect(() =>
    defineGame<object>()({
      ...author(),
      patterns: [
        {
          id: 'base',
          mechanics: [],
          actions: { pass: action },
          components: [track],
        },
      ],
      actions: { pass: overrideAction('wrong', action) },
    }),
  ).toThrow('remplacement');
  expect(() =>
    defineGame<object>()({
      ...author(),
      patterns: [{ id: 'base', mechanics: [], components: [track] }],
      components: [{ ...track, id: 'other', overrides: 'movement.track:road' }],
    }),
  ).toThrow('remplacement');
});

it('retains explicit overrides of existing pattern actions and components', () => {
  const action = author().actions.pass;
  const track = movement.track({ id: 'road', spaces: 10 });
  const compiled = defineGame<object>()({
    ...author(),
    patterns: [
      {
        id: 'base',
        mechanics: [],
        actions: { pass: action },
        components: [track],
      },
    ],
    actions: { pass: overrideAction('pass', action) },
    components: [overrideComponent(movement.track({ id: 'road', spaces: 20 }))],
  });
  expect(compiled.components).toHaveLength(1);
  expect(compiled.components[0]).toMatchObject({ id: 'road', spaces: 20 });
});

it('protects collections even in an explicitly supplied shallow-frozen content contract', () => {
  const map = new Map([['key', 1]]);
  const content = Object.freeze({
    kind: GAME_CONTENT_KIND,
    gameId: 'compilation-contract',
    version: 'explicit-version',
    data: Object.freeze({ map }),
  });
  const compiled = defineGame<object>()({ ...author(), content });
  const data = compiled.content.data as { map: ReadonlyMap<string, number> };
  expect(() => Map.prototype.set.call(data.map, 'key', 2)).toThrow(TypeError);
  map.set('key', 3);
  expect(data.map.get('key')).toBe(1);
  expect(compiled.contentVersion).toBe('explicit-version');
});

it('freezes nested configuration even when component builders froze the parent', () => {
  const positions = { 1: 0, 2: 1 };
  const initialization = Object.freeze({ tracks: { road: positions } });
  const compiled = defineGame<object>()({
    ...author(),
    components: [movement.track({ id: 'road', spaces: 10 })],
    initialization,
  });
  expect(Object.isFrozen(compiled.initialization?.tracks?.road)).toBe(true);
  expect(() => {
    positions[1] = 8;
  }).toThrow(TypeError);
});

it('compiles an author object once and keeps a distinct immutable runtime artifact', () => {
  const input = author();
  const compiled = defineGame<object>()(input);
  expect(compiled).not.toBe(input);
  expect(defineGame<object>()(input)).toBe(compiled);
  expect(defineGame<object>()(compiled)).toBe(compiled);
  expect(Object.isFrozen(input)).toBe(true);
  expect(Object.isFrozen(compiled)).toBe(true);
  expect(() => assertCompiledGameDefinition(compiled)).not.toThrow();
  expect(() => assertCompiledGameDefinition(input)).toThrow();
  expect(() => assertCompiledGameDefinition({ ...compiled })).toThrow();
});

it('prepares automatic priorities once with stable declaration order for ties', () => {
  const rule = (id: string, priority: number) =>
    when(
      id,
      () => false,
      () => {},
      { priority },
    );
  const compiled = defineGame<object>()({
    ...author(),
    automatic: [rule('last', 0), rule('first', 2), rule('second', 2)],
  });
  expect(compiled.automatic?.map(({ id }) => id)).toEqual([
    'first',
    'second',
    'last',
  ]);
});

it('lowers author patterns to a frozen data-only plan without losing execution hooks', () => {
  const beforeTurn = jest.fn();
  const compiled = defineGame<object>()({
    ...author(),
    patterns: [
      {
        id: 'timed-pattern',
        mechanics: ['scheduler'],
        lifecycle: { beforeTurn },
        initialization: { scores: 0 },
      },
    ],
  });
  expect(compiled.patterns).toEqual([
    { id: 'timed-pattern', mechanics: ['scheduler'] },
  ]);
  expect(compiled.plan.patterns).toEqual(compiled.patterns);
  expect(compiled.plan.capabilities).toEqual(['scheduler']);
  expect(compiled.plan.actionIds).toEqual(['pass']);
  expect(JSON.parse(JSON.stringify(compiled.plan))).toEqual(compiled.plan);
  expect(Object.isFrozen(compiled.plan.patterns[0].mechanics)).toBe(true);
  expect(describeGameDefinition(compiled).patterns).toEqual(
    compiled.plan.patterns,
  );
  const runtime = new DeclarativeGameRuntime(compiled);
  runtime.hydrateInitialState({
    version: 1,
    status: 'started',
    phase: 'setup',
    log: [],
    players: [{ id: 1, username: 'Lila' }],
    metadata: { rng: { seed: 42, counter: 0 } },
  });
  expect(beforeTurn).toHaveBeenCalledTimes(1);
});

it.each([
  { initialPhase: 'missing', phases: { playing: {} } },
  { phases: { playing: { next: 'missing' } } },
  { phases: { playing: { actions: ['missing'] } } },
  {
    phases: { playing: { timeout: { afterMs: -1, action: { type: 'pass' } } } },
  },
  {
    phases: {
      playing: { timeout: { afterMs: 10, action: { type: 'missing' } } },
    },
  },
])('rejects invalid phase references during compilation: %j', (phases) => {
  expect(() => defineGame<object>()({ ...author(), ...phases })).toThrow();
});
