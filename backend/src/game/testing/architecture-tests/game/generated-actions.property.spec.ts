import { compileJsonGame } from '../../../rules/public-api';
import { DeclarativeGameRuntime } from '../../../engine/runtime/declarative-game.runtime';
import {
  FixedGameClock,
  StateGameRng,
} from '../../../core/application/models/game-execution-context.model';
import type { GameState } from '../../../core/application/models/game-state.model';
import { drainPendingGameEvents } from '../../../core/application/services/game-event-buffer';
import manifest from '../../fixtures/json-course/manifest.json';
import document from '../../fixtures/json-course/game.json';

// Independent deterministic generator: a failure is reproducible with its seed.
function generate(seed: number) {
  let value = seed >>> 0;
  const integer = (max: number) => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value % max;
  };
  return {
    seed,
    players: 2 + integer(5),
    spaces: 2 + integer(39),
    wrap: integer(2) === 0,
    initial: integer(20),
    steps: Array.from({ length: 1 + integer(50) }, () => ({
      distance: integer(121) - 60,
      gain: integer(11),
      conditional: integer(2) === 0,
    })),
  };
}

function verify(scenario: ReturnType<typeof generate>) {
  const actions = Object.fromEntries(
    scenario.steps.map((step, index) => [
      `step${index}`,
      {
        effects: [
          { kind: 'roll-dice', diceId: 'dice' },
          { kind: 'move', trackId: 'board', spaces: step.distance },
          ...(step.conditional
            ? [
                {
                  kind: 'conditional',
                  condition: {
                    kind: 'resource',
                    resource: 'stars',
                    compare: 'gte',
                    amount: 20,
                  },
                  then: [
                    {
                      kind: 'gain-resource',
                      resource: 'stars',
                      amount: step.gain,
                    },
                  ],
                  else: [],
                },
              ]
            : [
                { kind: 'gain-resource', resource: 'stars', amount: step.gain },
              ]),
          { kind: 'complete-turn' },
        ],
      },
    ]),
  );
  const definition = compileJsonGame(
    { ...manifest, maxPlayers: 6 },
    {
      ...document,
      components: [
        {
          component: 'movement.track',
          id: 'board',
          spaces: scenario.spaces,
          overshoot: scenario.wrap ? 'wrap' : 'clamp',
        },
        { component: 'dice.set', id: 'dice', count: 2, sides: 6 },
      ],
      setup: {
        firstPlayer: 'first',
        resources: { stars: scenario.initial },
        tracks: { board: 0 },
      },
      actions,
      phases: { playing: { actions: Object.keys(actions), terminal: true } },
      victory: { kind: 'resource-at-least', resource: 'stars', amount: 100000 },
    },
  );
  const runtime = new DeclarativeGameRuntime(definition);
  const clock = new FixedGameClock(1700000000000);
  const base: GameState = {
    version: 1,
    status: 'started',
    phase: 'setup',
    log: [],
    players: Array.from({ length: scenario.players }, (_, index) => ({
      id: index + 1,
      username: `P${index + 1}`,
    })),
    metadata: { rng: { seed: scenario.seed, counter: 0 } },
  };
  const initial = runtime.hydrateInitialState(base, {
    actorId: null,
    clock,
    rng: new StateGameRng(base),
  });
  let state = structuredClone(initial);
  let replay = structuredClone(initial);
  const positions = Array<number>(scenario.players).fill(0);
  const balances = Array<number>(scenario.players).fill(scenario.initial);
  for (const [index, step] of scenario.steps.entries()) {
    const player = index % scenario.players;
    const actorId = player + 1;
    expect(state.turn?.currentPlayerId).toBe(actorId);
    const command = { type: `step${index}`, payload: {} };
    const apply = (before: GameState) => {
      const execution = { actorId, clock, rng: new StateGameRng(before) };
      const action = runtime.validateAction(
        before,
        command,
        actorId,
        execution,
      );
      return runtime.applyActions(before, [action], execution);
    };
    state = apply(state);
    // JSON round-trip exercises the persisted state boundary between every turn.
    replay = apply(JSON.parse(JSON.stringify(replay)) as GameState);
    expect(replay).toEqual(state);
    // The application consumes this outbox after each successful command.
    expect(drainPendingGameEvents(replay)).toEqual(
      drainPendingGameEvents(state),
    );
    positions[player] += step.distance;
    if (scenario.wrap) {
      while (positions[player] < 0) positions[player] += scenario.spaces;
      while (positions[player] >= scenario.spaces)
        positions[player] -= scenario.spaces;
    } else
      positions[player] = Math.max(
        0,
        Math.min(scenario.spaces - 1, positions[player]),
      );
    if (!step.conditional || balances[player] >= 20)
      balances[player] += step.gain;
    for (let other = 0; other < scenario.players; other++) {
      expect(state).toHaveProperty(
        `engine.kits.movement.positions.board.${other + 1}`,
        positions[other],
      );
      expect(state).toHaveProperty(
        `engine.playerValues.resources.stars.${other + 1}`,
        balances[other],
      );
    }
    expect(state.status).toBe('playing');
  }
}

it.each(Array.from({ length: 64 }, (_, index) => index + 1))(
  'preserves model, player isolation and replay for generated valid actions (seed=%i)',
  (seed) => {
    const scenario = generate(seed);
    try {
      verify(scenario);
    } catch (original) {
      // Shrink to the shortest failing prefix, retaining valid action dependencies.
      for (let count = 1; count <= scenario.steps.length; count++) {
        const reduced = { ...scenario, steps: scenario.steps.slice(0, count) };
        try {
          verify(reduced);
        } catch (error) {
          throw new Error(
            `Generated counterexample ${JSON.stringify(reduced)}\n${error instanceof Error ? error.message : String(error)}`,
            { cause: error },
          );
        }
      }
      throw original;
    }
  },
);
