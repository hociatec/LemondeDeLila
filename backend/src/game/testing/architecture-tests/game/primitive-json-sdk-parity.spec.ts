import { componentCases } from './component-parity-cases';
import { jsonGameSchema } from '../../../engine/runtime/definitions/json-game-schema';
import { effectJsonDefinitions } from '../../../engine/runtime/contracts/effect-json-schema';
import {
  defineAction,
  defineGame,
  defineEffect,
  gameInput,
} from '../../../engine/sdk/public-api';
import { compileJsonGame } from '../../../engine/runtime/definitions/json-game-compiler';
import { defineJsonEffectPack } from '../../../engine/runtime/contracts/json-effect-pack';
import { authorObject } from '../../../engine/runtime/contracts/json-author-schema';
import { DeclarativeGameRuntime } from '../../../engine/testing/public-api';
import type { GameEffectInstruction } from '../../../engine/runtime/contracts/effect-ir';
import type { GameInitialization } from '../../../engine/runtime/definitions/component-kit';
import type { MutableStateCopy } from '../../../engine/runtime/contracts/state-copy';
import type { DeclarativeState } from '../../../engine/runtime/state/declarative-state';
import type { GameState } from '../../../core/application/models/game-state.model';
import {
  FixedGameClock,
  StateGameRng,
} from '../../../core/application/models/game-execution-context.model';
import {
  primitiveCases,
  conditionCases,
  targetCases,
  choiceAvailabilityCases,
  type Pair,
} from './primitive-parity-cases';
import manifest from '../../fixtures/json-course/manifest.json';
import document from '../../fixtures/json-course/game.json';

const cases: Record<string, Pair<readonly GameEffectInstruction[]>> = {};
for (const [name, pair] of Object.entries(primitiveCases)) {
  const before: GameEffectInstruction[] =
    name === 'end-round' ? [{ kind: 'start-round' }] : [];
  cases[`effect-${name}`] = {
    json: [...before, pair.json],
    sdk: [...before, pair.sdk],
  };
}
for (const [name, pair] of Object.entries(conditionCases))
  for (const invert of [false, true]) {
    const instruction = (
      condition: typeof pair.json | typeof pair.sdk,
    ): GameEffectInstruction => ({
      kind: 'conditional',
      condition: invert ? { kind: 'not', condition } : condition,
      then: [{ kind: 'gain-score', amount: 5 }],
      else: [{ kind: 'gain-score', amount: -2 }],
    });
    cases[`condition-${name}-${invert}`] = {
      json: [instruction(pair.json)],
      sdk: [instruction(pair.sdk)],
    };
  }
for (const [name, pair] of Object.entries(targetCases))
  cases[`target-${name}`] = {
    json: [{ kind: 'gain-score', amount: 3, target: pair.json }],
    sdk: [{ kind: 'gain-score', amount: 3, target: pair.sdk }],
  };
for (const [name, pair] of Object.entries(choiceAvailabilityCases))
  cases[`availability-${name}`] = { json: [pair.json], sdk: [pair.sdk] };

const components = componentCases.map((pair) => pair.json);
const initialization: GameInitialization = {
  firstPlayer: 'first',
  startRound: false,
  scores: { 1: 2, 2: 2, 3: 0 },
  resources: { stars: 10, coins: 7 },
  tracks: { board: { 1: 2, 2: 4, 3: 0 } },
  pawns: [{ setId: 'pawns', assignment: 'round-robin' }],
};
const phases = { playing: { actions: Object.keys(cases), terminal: true } };
function customEffects() {
  return {
    'parity.add': defineEffect<Record<string, never>, { amount: number }>({
      input: gameInput.object({ amount: gameInput.number({ integer: true }) }),
      apply: ({ actorPlayerId, data, ctx }) => {
        if (actorPlayerId != null) ctx.score.add(actorPlayerId, data.amount);
      },
    }),
  };
}
const parityExtension = defineJsonEffectPack({
  scope: 'game-specific',
  domain: 'choice',
  documentKey: 'parity',
  outputKey: 'parity',
  schema: authorObject({}),
  compile: (_program: Record<string, never>) => customEffects(),
  handlers: (_context, effects) => ({ effects }),
});
const jsonDefinition = compileJsonGame(
  { ...manifest, maxPlayers: 3 },
  {
    ...document,
    extensions: [{ type: 'parity', config: {} }],
    components,
    setup: initialization,
    phases,
    resourceIds: ['stars', 'coins'],
    actions: Object.fromEntries(
      Object.entries(cases).map(([name, pair]) => [
        name,
        { effects: pair.json },
      ]),
    ),
    victory: { kind: 'resource-at-least', resource: 'stars', amount: 10000 },
  },
  undefined,
  {},
  [parityExtension],
);
const sdkDefinition = defineGame<Record<string, never>>()({
  id: manifest.code,
  displayName: manifest.name,
  category: document.category,
  players: { min: manifest.minPlayers, max: 3 },
  content: jsonDefinition.content,
  effects: customEffects(),
  components: componentCases.map((pair) => pair.sdk),
  initialization,
  phases,
  initialPhase: 'playing',
  resourceIds: ['stars', 'coins'],
  actions: Object.fromEntries(
    Object.entries(cases).map(([name, pair]) => [
      name,
      defineAction<Record<string, never>, Record<string, never>>({
        input: gameInput.object({}),
        execute: ({ ctx }) => ctx.effects.run(...pair.sdk),
      }),
    ]),
  ),
});
const runtimes = [
  new DeclarativeGameRuntime(jsonDefinition),
  new DeclarativeGameRuntime(sdkDefinition),
];
const clock = new FixedGameClock(1700000000000);

function initial(runtime: (typeof runtimes)[number], seed: number) {
  const base: GameState = {
    version: 1,
    status: 'started',
    phase: 'setup',
    log: [],
    players: [1, 2, 3].map((id) => ({ id, username: `P${id}` })),
    metadata: { rng: { seed, counter: 0 } },
  };
  const state = structuredClone(
    runtime.hydrateInitialState(base, {
      actorId: null,
      clock,
      rng: new StateGameRng(base),
    }),
  ) as MutableStateCopy<DeclarativeState<Record<string, never>>>;
  const { inventory, ownership } = state.engine.kits;
  if (!inventory || !ownership) throw new Error('Missing parity components');
  inventory.byPlayer.bag = {
    1: ['apple', 'apple', 'pear'],
    2: ['pear', 'pear'],
    3: ['apple'],
  };
  ownership.owners.land.house = [1];
  state.engine.playerValues.statuses['1'] = [
    { id: 'shield', scope: 'until-used', remaining: null, data: {} },
  ];
  return state;
}

function apply(
  runtime: (typeof runtimes)[number],
  state: GameState,
  type: string,
  payload: Record<string, unknown> = {},
) {
  const execution = { actorId: 1, clock, rng: new StateGameRng(state) };
  return runtime.applyActions(
    state,
    [runtime.validateAction(state, { type, payload }, 1, execution)],
    execution,
  );
}

describe.each([3, 91])('JSON/SDK primitive semantics, seed %i', (seed) => {
  it.each(Object.keys(cases))(
    '%s matches state, events, randomness and restored execution',
    (name) => {
      const outputs = runtimes.map((runtime) => {
        const before = initial(runtime, seed);
        const replay = JSON.parse(JSON.stringify(before)) as GameState;
        const result = apply(runtime, before, name);
        expect(apply(runtime, replay, name)).toEqual(result);
        return result;
      });
      expect(outputs[1]).toEqual(outputs[0]);
      if (name.startsWith('condition-'))
        expect(
          (outputs[0] as DeclarativeState<object>).engine.playerValues.scores[
            '1'
          ],
        ).toBe(name.endsWith('-true') ? 0 : 7);
      if (outputs[0].pending) {
        const value =
          name === 'availability-cards'
            ? 'a'
            : name === 'availability-resources'
              ? 'stars'
              : name === 'effect-reaction'
                ? 'yes'
                : 2;
        const resolved = outputs.map((state, i) =>
          apply(
            runtimes[i],
            JSON.parse(JSON.stringify(state)) as GameState,
            'choice.resolve',
            { value },
          ),
        );
        expect(resolved[1]).toEqual(resolved[0]);
        expect(resolved[0].pending).toBeNull();
      }
    },
  );
});

it('covers every component exposed by the JSON grammar', () => {
  const variants = jsonGameSchema.properties?.components.items?.oneOf;
  expect(variants).toBeDefined();
  expect(componentCases.map((pair) => pair.json.component).sort()).toEqual(
    variants?.map((schema) => schema.properties?.component.const).sort(),
  );
});

it.each([
  ['effect', primitiveCases],
  ['condition', conditionCases],
  ['target', targetCases],
  ['availability', choiceAvailabilityCases],
] as const)(
  'covers every %s variant in the published JSON grammar',
  (name, examples) => {
    expect(Object.keys(examples).sort()).toEqual(
      effectJsonDefinitions[name].oneOf
        ?.map((schema) => schema.properties?.kind.const)
        .sort(),
    );
  },
);

it.each([3, 91])(
  'component initialization and public/private views match for seed %i',
  (seed) => {
    const states = runtimes.map((runtime) => initial(runtime, seed));
    expect(states[1]).toEqual(states[0]);
    for (const playerId of [1, 2, 3, 99])
      expect(runtimes[1].exposeStateForUser(states[1], playerId)).toEqual(
        runtimes[0].exposeStateForUser(states[0], playerId),
      );
  },
);
