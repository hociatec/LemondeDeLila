import {
  FixedGameClock,
  StateGameRng,
} from '../../../core/application/models/game-execution-context.model';
import {
  defineAction,
  defineGame,
  gameInput,
  when,
} from '../../../engine/sdk/public-api';
import { DeclarativeLifecycle } from '../../../engine/runtime/lifecycle/declarative-lifecycle';
import { ContractGameRuntime } from './game-stability-auditor';

function fixture() {
  const definition = defineGame<{ armed: boolean }>()({
    id: 'stability-contract',
    displayName: 'Stability',
    category: 'test',
    players: { min: 1, max: 2 },
    setup: () => ({ armed: false }),
    actions: {
      arm: defineAction({
        input: gameInput.object({}),
        execute: ({ state }) => {
          state.armed = true;
        },
      }),
    },
    automatic: [
      when(
        'unbounded-score',
        ({ state }) => state.armed,
        ({ ctx }) => {
          ctx.score.add(1, 1);
        },
      ),
    ],
  });
  const adapter = new ContractGameRuntime(definition);
  const clock = new FixedGameClock(1_700_000_000_000);
  const state = adapter.hydrateInitialState({
    status: 'started',
    phase: 'playing',
    log: [],
    players: [{ id: 1, username: 'Test' }],
  });
  return { adapter, state, clock };
}

afterEach(() => jest.restoreAllMocks());

it('accepts a fixed point without changing its persisted input', () => {
  const { adapter, state, clock } = fixture();
  const before = JSON.stringify(state);
  adapter.assertStabilized(state, clock);
  adapter.assertStabilized(state, clock);
  expect(JSON.stringify(state)).toBe(before);
});

it('detects a repeated mutation even when the rule ID remains unchanged', () => {
  const { adapter, state, clock } = fixture();
  jest
    .spyOn(DeclarativeLifecycle.prototype, 'stabilize')
    .mockImplementation((_runtime, ctx) => {
      ctx.score.add(1, 1);
    });
  expect(() => adapter.assertStabilized(state, clock)).toThrow(
    'Repeated stabilization',
  );
});

it('detects repeated events without a persisted state mutation', () => {
  const { adapter, state, clock } = fixture();
  jest
    .spyOn(DeclarativeLifecycle.prototype, 'stabilize')
    .mockImplementation((_runtime, ctx) => {
      ctx.events.engine('game.automatic', { ruleId: 'duplicate', priority: 0 });
    });
  expect(() => adapter.assertStabilized(state, clock)).toThrow(
    'Repeated stabilization',
  );
});

it('rejects a command that starts an unbounded mutating rule without changing its input', () => {
  const { adapter, state, clock } = fixture();
  const before = JSON.stringify(state);
  expect(() =>
    adapter.applyActions(
      state,
      [{ type: 'arm', payload: {}, meta: { actorId: 1 } }],
      {
        actorId: 1,
        clock,
        rng: new StateGameRng(state),
      },
    ),
  ).toThrow('Boucle automatique non convergente');
  expect(JSON.stringify(state)).toBe(before);
});
