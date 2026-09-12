import { compileJsonGame } from './json-game-compiler';
import { DeclarativeGameRuntime } from '../declarative-game.runtime';
import type { EffectTarget } from '../contracts/effect-ir';
import { assertTargetJson } from '../contracts/effect-json-schema';
import {
  FixedGameClock,
  StateGameRng,
} from '../../../core/application/models/game-execution-context.model';
import type { GameState } from '../../../core/application/models/game-state.model';
import manifest from '../../../testing/fixtures/json-course/manifest.json';
import document from '../../../testing/fixtures/json-course/game.json';

function execute(target: EffectTarget, reverse = false) {
  const definition = compileJsonGame(
    { ...manifest, maxPlayers: 4 },
    {
      ...document,
      components: [],
      setup: {
        firstPlayer: 'first',
        scores: { 30: 5, 10: 5, 20: -1, 40: -1 },
        resources: { stars: 0 },
      },
      actions: {
        advance: {
          effects: [
            ...(reverse ? [{ kind: 'reverse-turn-order' }] : []),
            { kind: 'gain-resource', resource: 'stars', amount: 1, target },
          ],
        },
      },
    },
  );
  const runtime = new DeclarativeGameRuntime(definition);
  const base: GameState = {
    version: 1,
    status: 'started',
    phase: 'setup',
    log: [],
    players: [30, 10, 20, 40].map((id) => ({ id, username: `Player ${id}` })),
    metadata: { rng: { seed: 42, counter: 0 } },
  };
  const initial = runtime.hydrateInitialState(base, {
    actorId: null,
    clock: new FixedGameClock(1000),
    rng: new StateGameRng(base),
  });
  const apply = () =>
    runtime.applyActions(
      initial,
      [runtime.validateAction(initial, { type: 'advance', payload: {} }, 30)],
      {
        actorId: 30,
        clock: new FixedGameClock(1000),
        rng: new StateGameRng(initial),
      },
    );
  return { initial, apply };
}

it.each<[EffectTarget, number[]]>([
  [{ kind: 'previous' }, [40]],
  [{ kind: 'next' }, [10]],
  [{ kind: 'leader', ties: 'all' }, [30, 10]],
  [{ kind: 'leader', ties: 'lowest-id' }, [10]],
  [{ kind: 'last', ties: 'all' }, [20, 40]],
  [{ kind: 'last', ties: 'lowest-id' }, [20]],
])(
  'executes a canonical selector %j through JSON compilation',
  (target, selected) => {
    const { apply } = execute(target);
    const state = apply();
    for (const id of [30, 10, 20, 40]) {
      expect(state).toHaveProperty(
        `engine.playerValues.resources.stars.${id}`,
        selected.includes(id) ? 1 : 0,
      );
    }
  },
);

it('respects reversed turn order for previous', () => {
  expect(
    execute({ kind: 'previous', order: 'turn' }, true).apply(),
  ).toHaveProperty('engine.playerValues.resources.stars.10', 1);
});

it.each<EffectTarget>([
  { kind: 'random-player' },
  { kind: 'random-opponent' },
  { kind: 'leader', ties: 'random' },
  { kind: 'last', ties: 'random' },
])('replays random selector %j from the persisted RNG state', (target) => {
  const first = execute(target);
  const hostRandom = jest.spyOn(Math, 'random').mockImplementation(() => {
    throw new Error('Selectors must use the engine RNG');
  });
  try {
    const result = first.apply();
    expect(result).toEqual(first.apply());
    expect(result.metadata?.rng).toEqual({ seed: 42, counter: 1 });
    expect(hostRandom).not.toHaveBeenCalled();
  } finally {
    hostRandom.mockRestore();
  }
  expect(first.initial.metadata?.rng).toEqual({ seed: 42, counter: 0 });
});

it.each([
  { kind: 'leader' },
  { kind: 'last', ties: 'first-entry' },
  { kind: 'previous', offset: 'eval(1)' },
])('rejects ambiguous or executable selectors %j', (target) => {
  expect(() => assertTargetJson(target)).toThrow();
});
