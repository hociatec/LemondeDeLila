import { createJsonGameCompiler } from '../../../engine/runtime/definitions/json-game-compiler-factory';
import {
  DeclarativeGameRuntime,
  testGame,
} from '../../../engine/testing/public-api';
import manifest from '../../../testing/fixtures/json-course/manifest.json';
import { effectPack } from './effect-pack';
import type { PawScoringProgram } from './program';

// Deliberately unrelated identifiers, distances, limits and status storage.
const program: PawScoringProgram = {
  deckId: 'supply',
  handId: 'crew',
  trackId: 'route',
  goal: 90,
  initialHandSize: 1,
  defaultRounds: 2,
  statusPrefix: 'journey.',
  mechanics: {
    statuses: {
      obstacle: 'hazard',
      power: 'upgrade.',
      activated: 'ready',
      activationUsed: 'started',
      obstacleLock: 'repairing',
    },
    activationCounter: 'ignition',
    counters: ['ignition', 'repair'],
    obstacles: [
      { id: 'barrier', counter: 'repair', blocks: true },
      { id: 'fog', counter: 'ignition', blocks: false, maximumMove: 7 },
    ],
    powers: [
      {
        id: 'shield',
        ignores: ['barrier'],
        disablesCounters: ['repair'],
        bypassesActivation: false,
      },
      {
        id: 'autopilot',
        ignores: ['fog'],
        disablesCounters: ['ignition'],
        bypassesActivation: true,
      },
    ],
    moveLimits: [
      { value: 19, uses: 1, resource: 'boosts' },
      { value: 7, uses: 3, resource: 'steps' },
    ],
    finishReason: 'distance-scored',
  },
  cards: [
    ...[7, 19, 64].map((value) => ({
      id: 'move-' + value,
      name: 'Move',
      type: 'pattes' as const,
      value,
      effects: [
        {
          kind: 'custom' as const,
          effectId: 'paw-round.move',
          data: { value },
        },
      ],
    })),
    ...['repair', 'ignition'].map((parade) => ({
      id: parade,
      name: parade,
      type: 'parade' as const,
      parade,
      effects: [
        {
          kind: 'custom' as const,
          effectId: 'paw-round.parade',
          data: { parade },
        },
        { kind: 'complete-turn' as const },
      ],
    })),
    ...['shield', 'autopilot'].map((bot) => ({
      id: bot,
      name: bot,
      type: 'bot' as const,
      bot,
      effects: [
        {
          kind: 'custom' as const,
          effectId: 'paw-round.power',
          data: { power: bot },
        },
      ],
    })),
  ],
};
const compiler = createJsonGameCompiler([effectPack]);
const document = (source: PawScoringProgram) => ({
  schemaVersion: 1,
  contentVersion: '1',
  definitionVersion: '1',
  category: 'JeuxDePlateaux',
  world: 'VentsDansants',
  patterns: [],
  components: [],
  setup: {},
  resourceIds: [],
  initialPhase: 'setup',
  phases: {
    setup: { actions: [], transitions: ['playing'] },
    playing: { actions: ['draw', 'play', 'discard'], terminal: true },
  },
  actions: {
    draw: { recipe: 'paw-round-draw' },
    play: { recipe: 'paw-round-play' },
    discard: { recipe: 'paw-round-discard' },
  },
  victory: { kind: 'by-paw-scoring' },
  pawScoring: source,
});
const definition = compiler.compileJsonGame(manifest, document(program));
const runtime = new DeclarativeGameRuntime(definition);
function status(id: string, data = {}) {
  return { id: 'journey.' + id, scope: 'round', remaining: null, data };
}
async function fixture(hazard?: string, ready = true) {
  const game = testGame(definition).players(['A', 'B']).seed(42);
  await game.start();
  await game.as(1).do('game.configure', { roundsToPlay: 2 });
  const state: any = game.state();
  state.engine.playerValues.statuses['1'] = ready
    ? [status('ready'), status('started')]
    : [];
  if (hazard)
    state.engine.playerValues.statuses['1'].push(
      status('hazard', { obstacle: hazard }),
    );
  state.engine.kits.cards.hands.crew['1'] = program.cards.map(
    (card) => card.id,
  );
  return act(state, 'draw');
}
function act(state: any, type: string, payload = {}) {
  return runtime.applyActions(state, [
    { type, payload, meta: { actorId: 1 } },
  ]) as any;
}
function playable(state: any) {
  return runtime
    .getAvailableActions(state, 1)
    .filter((action) => action.type === 'play')
    .map((action) => action.payload?.cardId);
}
function nextTurn(state: any) {
  state.turn.currentPlayerId = 1;
  return act(state, 'draw');
}

it('uses the configured blocking and matching counter relationships', async () => {
  const state = await fixture('barrier');
  expect(playable(state)).toEqual(['repair', 'shield']);
  expect(() => act(state, 'play', { cardId: 'move-7' })).toThrow();
  const repaired = act(state, 'play', { cardId: 'repair' });
  expect(
    repaired.engine.playerValues.statuses['1'].map((entry: any) => entry.id),
  ).toEqual(['journey.repairing']);
  expect(playable(nextTurn(repaired))).toContain('ignition');
});

it('uses a configured movement cap and activation counter', async () => {
  const state = await fixture('fog');
  expect(playable(state)).toContain('move-7');
  expect(playable(state)).not.toContain('move-19');
  expect(playable(state)).toContain('ignition');
  const cleared = nextTurn(act(state, 'play', { cardId: 'ignition' }));
  expect(playable(cleared)).toContain('move-19');
});

it('uses configured immunities and activation bypass', async () => {
  let state = await fixture('fog', false);
  expect(playable(state)).not.toContain('move-7');
  state = act(state, 'play', { cardId: 'autopilot' });
  state = nextTurn(state);
  expect(playable(state)).toContain('move-19');
  expect(playable(state)).not.toContain('ignition');
  expect(
    state.engine.playerValues.statuses['1'].map((entry: any) => entry.id),
  ).toEqual(['journey.upgrade.autopilot']);
});

it('counts arbitrary limited distances independently and rejects a spent move', async () => {
  let state = act(await fixture(), 'play', { cardId: 'move-19' });
  expect(state.engine.playerValues.resources['journey.boosts']['1']).toBe(1);
  state = nextTurn(state);
  state.engine.kits.cards.hands.crew['1'].push('move-19');
  expect(playable(state)).not.toContain('move-19');
  expect(playable(state)).toContain('move-7');
  expect(() => act(state, 'play', { cardId: 'move-19' })).toThrow();
  state = act(state, 'play', { cardId: 'move-7' });
  expect(state.engine.playerValues.resources['journey.steps']['1']).toBe(1);
  expect(state.engine.playerValues.resources['journey.boosts']['1']).toBe(1);
  state = act(nextTurn(state), 'play', { cardId: 'move-64' });
  expect(state.engine.playerValues.resources['journey.steps']['1']).toBe(0);
  expect(state.engine.playerValues.resources['journey.boosts']['1']).toBe(0);
  state.engine.kits.cards.hands.crew['1'] = program.cards.map(
    (card) => card.id,
  );
  state.engine.playerValues.statuses['1'] = [
    status('ready'),
    status('started'),
  ];
  for (const value of [19, 7, 64])
    state = act(nextTurn(state), 'play', { cardId: 'move-' + value });
  expect(state.status).toBe('finished');
  expect(state.engine.match.result.reason).toBe('distance-scored');
});

it.each([
  (rules: PawScoringProgram['mechanics']) => {
    rules.activationCounter = 'missing';
  },
  (rules: PawScoringProgram['mechanics']) => {
    rules.obstacles = [{ id: 'x', counter: 'missing', blocks: true }];
  },
  (rules: PawScoringProgram['mechanics']) => {
    rules.powers = [
      {
        id: 'x',
        ignores: ['missing'],
        disablesCounters: [],
        bypassesActivation: false,
      },
    ];
  },
  (rules: PawScoringProgram['mechanics']) => {
    rules.counters = ['ignition', 'ignition'];
  },
  (rules: PawScoringProgram['mechanics']) => {
    rules.statuses.activated = rules.statuses.obstacle;
  },
  (rules: PawScoringProgram['mechanics']) => {
    rules.moveLimits = [{ value: 19, uses: 0, resource: 'x' }];
  },
  (rules: PawScoringProgram['mechanics']) => {
    rules.moveLimits = [
      { value: 19, uses: 1, resource: 'x' },
      { value: 7, uses: 2, resource: 'x' },
    ];
  },
])('rejects inconsistent mechanics before starting a game (%#)', (change) => {
  const changed = structuredClone(program);
  change(changed.mechanics);
  expect(() => compiler.compileJsonGame(manifest, document(changed))).toThrow();
});
