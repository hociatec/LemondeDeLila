import { createJsonGameCompiler } from './json-game-compiler-factory';
import { defineJsonEffectPack } from '../contracts/json-effect-pack';
import { authorObject, authorPositive } from '../contracts/json-author-schema';
import { defineEmptyAction } from '../actions/action-builders';
import { DeclarativeGameRuntime } from '../declarative-game.runtime';
import {
  FixedGameClock,
  StateGameRng,
} from '../../../core/application/models/game-execution-context.model';
import type { GameState } from '../../../core/application/models/game-state.model';
import manifest from '../../../testing/fixtures/json-course/manifest.json';
import document from '../../../testing/fixtures/json-course/game.json';

// A new rule unknown to the shipped catalogue. No production registration needed.
const extension = (documentKey: string) =>
  defineJsonEffectPack({
    capabilities: ['actions', 'viewExtension'],
    scope: 'game-specific',
    domain: 'choice',
    documentKey,
    outputKey: documentKey,
    schema: authorObject({ points: authorPositive }),
    compile: (source: { points: number }) => {
      const { points } = source;
      return defineEmptyAction<Record<string, never>>({
        execute: ({ actor, ctx }) => ctx.score.add(actor.id, points),
      });
    },
    actions: (action) => ({ 'award-configured-points': action }),
    handlers: () => ({
      viewExtension: () => ({ extensionLabel: documentKey }),
    }),
  });
const source = (key: string, points: number) => ({
  ...document,
  [key]: { points },
  actions: { advance: { recipe: 'award-configured-points' } },
  victory: { kind: 'score-at-least', amount: points },
});

describe('extension composition', () => {
  const objective = (key: string) =>
    defineJsonEffectPack({
      capabilities: ['victory'],
      scope: 'game-specific',
      domain: 'choice',
      documentKey: key,
      outputKey: key,
      schema: authorObject({ points: authorPositive }),
      compile: (program: { points: number }) => program,
      victoryKind: `by-${key}`,
      victoryRequired: false,
      handlers: () => ({
        victory: { evaluate: () => ({ winnerPlayerIds: [1], reason: key }) },
      }),
    });
  const hybrid = {
    ...source('award', 7),
    first: { points: 1 },
    second: { points: 2 },
    victory: { kind: 'by-second' },
  };
  it('combines independent capabilities and selects victory independently of catalogue order', () => {
    for (const objectives of [
      [objective('first'), objective('second')],
      [objective('second'), objective('first')],
    ]) {
      const definition = createJsonGameCompiler([
        extension('award'),
        ...objectives,
      ]).compileJsonGame(manifest, hybrid);
      const runtime = new DeclarativeGameRuntime(definition);
      const initial = runtime.hydrateInitialState({
        version: 1,
        status: 'started',
        phase: 'setup',
        log: [],
        players: [
          { id: 1, username: 'Alice' },
          { id: 2, username: 'Bob' },
        ],
        metadata: { rng: { seed: 42, counter: 0 } },
      });
      const action = runtime.validateAction(
        initial,
        { type: 'advance', payload: {} },
        1,
      );
      const result = runtime.applyActions(initial, [action], {
        actorId: 1,
        clock: new FixedGameClock(1000),
        rng: new StateGameRng(initial),
      });
      expect(result.status).toBe('finished');
      expect(result).toHaveProperty('engine.playerValues.scores.1', 7);
      expect(runtime.exposeStateForUser(result, 1).game).toEqual({
        extensionLabel: 'award',
      });
      expect(JSON.stringify(result)).toContain('second');
    }
  });
  it('rejects setup, handler and action conflicts before play', () => {
    expect(() =>
      createJsonGameCompiler([
        extension('award'),
        { ...objective('first'), ownsSetup: true },
        { ...objective('second'), ownsSetup: true },
      ]).compileJsonGame(manifest, hybrid),
    ).toThrow(/only one extension may own setup/);
    expect(() =>
      createJsonGameCompiler([
        extension('award'),
        extension('other'),
      ]).compileJsonGame(manifest, {
        ...source('award', 7),
        other: { points: 1 },
      }),
    ).toThrow(/unique extension action recipe/);
    const other = defineJsonEffectPack({
      capabilities: ['viewExtension'],
      scope: 'game-specific',
      domain: 'choice',
      documentKey: 'other',
      outputKey: 'other',
      schema: authorObject({ points: authorPositive }),
      compile: (program: { points: number }) => program,
      handlers: () => ({ viewExtension: () => ({ other: true }) }),
    });
    expect(() =>
      createJsonGameCompiler([extension('award'), other]).compileJsonGame(
        manifest,
        {
          ...source('award', 7),
          other: { points: 1 },
        },
      ),
    ).toThrow(/unique handler owner for viewExtension/);
  });
});

it('runs primitive JSON without loading any application catalogue', () => {
  expect(() =>
    createJsonGameCompiler().compileJsonGame(manifest, document),
  ).not.toThrow();
  expect(() =>
    createJsonGameCompiler().compileJsonGame(manifest, source('newRule', 7)),
  ).toThrow();
});

describe('optional extension victory', () => {
  const pack = { ...extension('newRule'), victoryKind: 'by-example' };
  it('keeps coupled victory mandatory unless explicitly opted out', () => {
    expect(() =>
      createJsonGameCompiler([pack]).compileJsonGame(
        manifest,
        source('newRule', 7),
      ),
    ).toThrow('program and victory required together');
  });
  it('allows an opted-out extension with an independent objective', () => {
    expect(() =>
      createJsonGameCompiler([
        { ...pack, victoryRequired: false },
      ]).compileJsonGame(manifest, source('newRule', 7)),
    ).not.toThrow();
  });
  it.each([undefined, false])(
    'never accepts extension victory without its program (%s)',
    (victoryRequired) => {
      expect(() =>
        createJsonGameCompiler([{ ...pack, victoryRequired }]).compileJsonGame(
          manifest,
          { ...document, victory: { kind: 'by-example' } },
        ),
      ).toThrow('program and victory required together');
    },
  );
});

it('normalizes validated extension entries to the same immutable content as legacy documents', () => {
  const compiler = createJsonGameCompiler([extension('newRule')]);
  const legacy = source('newRule', 7);
  const config = { points: 7 };
  const core: Record<string, unknown> = { ...legacy };
  delete core.newRule;
  const generic = { ...core, extensions: [{ type: 'newRule', config }] };
  expect(compiler.parseJsonGame(generic)).toEqual(
    compiler.parseJsonGame(legacy),
  );
  expect(() => compiler.compileJsonGame(manifest, generic)).not.toThrow();
  expect(generic.extensions).toHaveLength(1);
  for (const extensions of [
    [{ type: 'unknown', config }],
    [{ type: 'newRule', config: { points: 'seven' } }],
    [{ type: 'newRule', config, extra: true }],
    [{ type: 'newRule' }],
  ])
    expect(() => compiler.parseJsonGame({ ...core, extensions })).toThrow(
      /extensions/,
    );
  expect(() =>
    compiler.parseJsonGame({ ...legacy, extensions: generic.extensions }),
  ).toThrow(/duplicate extension/);
  expect(() => createJsonGameCompiler([extension('extensions')])).toThrow(
    /reserved/,
  );
});

it.each([
  ['firstRule', 7],
  ['unrelatedRule', 19],
] as const)(
  'executes a previously unknown %s extension from JSON',
  (key, points) => {
    const compiler = createJsonGameCompiler([extension(key)]);
    const runtime = new DeclarativeGameRuntime(
      compiler.compileJsonGame(manifest, source(key, points)),
    );
    const seed: GameState = {
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
    const initial = runtime.hydrateInitialState(seed);
    const action = runtime.validateAction(
      initial,
      { type: 'advance', payload: {} },
      1,
    );
    const result = runtime.applyActions(initial, [action], {
      actorId: 1,
      clock: new FixedGameClock(1000),
      rng: new StateGameRng(initial),
    });
    expect(result.status).toBe('finished');
    expect(result).toHaveProperty('engine.playerValues.scores.1', points);
    expect(runtime.exposeStateForUser(result, 1).game).toEqual({
      extensionLabel: key,
    });
  },
);

it('isolates catalogues and keeps their schema immutable after creation', () => {
  const schema = authorObject({ points: authorPositive });
  const packs = [{ ...extension('firstRule'), schema }];
  const first = createJsonGameCompiler(packs);
  const second = createJsonGameCompiler([extension('secondRule')]);
  packs.length = 0;
  schema.required = ['somethingElse'];
  expect(() =>
    first.compileJsonGame(manifest, source('firstRule', 4)),
  ).not.toThrow();
  expect(() =>
    second.compileJsonGame(manifest, source('firstRule', 4)),
  ).toThrow();
  expect(() =>
    first.compileJsonGame(manifest, source('secondRule', 4)),
  ).toThrow();
  expect(Object.isFrozen(first.jsonGameSchema)).toBe(true);
});

it('rejects malformed extension data and unprovided recipes before play', () => {
  const compiler = createJsonGameCompiler([extension('newRule')]);
  for (const value of [0, -1, '5', null]) {
    expect(() =>
      compiler.compileJsonGame(manifest, {
        ...source('newRule', 5),
        newRule: { points: value },
      }),
    ).toThrow();
  }
  expect(() =>
    compiler.compileJsonGame(manifest, {
      ...source('newRule', 5),
      newRule: { points: 5, arbitrary: true },
    }),
  ).toThrow();
  expect(() =>
    compiler.compileJsonGame(manifest, {
      ...source('newRule', 5),
      actions: { advance: { recipe: 'unprovided' } },
    }),
  ).toThrow(/recipe program required/);
});

it('rejects ambiguous or reserved catalogue keys', () => {
  const pack = extension('newRule');
  expect(() => createJsonGameCompiler([pack, pack])).toThrow(/Duplicate/);
  for (const key of ['actions', 'schemaVersion', '__proto__', 'constructor'])
    expect(() => createJsonGameCompiler([extension(key)])).toThrow(/reserved/);
  expect(() =>
    createJsonGameCompiler([
      pack,
      { ...extension('secondRule'), outputKey: pack.outputKey },
    ]),
  ).toThrow(/outputKey/);
  expect(() =>
    createJsonGameCompiler([{ ...pack, outputKey: 'patterns' }]),
  ).toThrow(/reserved/);
  expect(() =>
    createJsonGameCompiler([{ ...pack, victoryKind: 'score-at-least' }]),
  ).toThrow(/by-/);
  expect(() =>
    createJsonGameCompiler([
      { ...pack, victoryKind: 'by-example' },
      { ...extension('secondRule'), victoryKind: 'by-example' },
    ]),
  ).toThrow(/Duplicate/);
});
