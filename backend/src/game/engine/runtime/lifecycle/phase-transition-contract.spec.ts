import {
  FixedGameClock,
  StateGameRng,
} from '../../../core/application/models/game-execution-context.model';
import type { GameState } from '../../../core/application/models/game-state.model';
import { defineAction } from '../actions/action-builders';
import { defineGame } from '../definitions/game-definition';
import { type DeclarativeState } from '../state/declarative-state';
import { gameInput } from '../actions/game-input-schema';
import { DeclarativeGameRuntime } from '../declarative-game.runtime';

function fixture() {
  const hooks: string[] = [];
  const definition = defineGame<object>()({
    id: 'phase-transition-contract',
    displayName: 'Phase',
    category: 'test',
    players: { min: 1, max: 2 },
    initialPhase: 'first',
    phases: {
      first: {
        transitions: ['second'],
        enter: () => {
          hooks.push('first.enter');
        },
        exit: () => {
          hooks.push('first.exit');
        },
        timeout: { afterMs: 1000, action: { type: 'advance' } },
      },
      second: {
        terminal: true,
        enter: () => {
          hooks.push('second.enter');
        },
        exit: () => {
          hooks.push('second.exit');
        },
        timeout: { afterMs: 2000, action: { type: 'advance' } },
      },
    },
    actions: {
      advance: defineAction({
        input: gameInput.object({}),
        execute: ({ ctx }) => ctx.transitionTo('second'),
      }),
      rewind: defineAction({
        input: gameInput.object({}),
        execute: ({ ctx }) => ctx.transitionTo('first'),
      }),
    },
  });
  const runtime = new DeclarativeGameRuntime(definition);
  const clock = new FixedGameClock(1_700_000_000_000);
  const base = {
    status: 'started',
    phase: 'first',
    log: [],
    players: [{ id: 1, username: 'Test' }],
  };
  const initial = runtime.hydrateInitialState(base, {
    actorId: null,
    clock,
    rng: new StateGameRng(base),
  }) as DeclarativeState<object>;
  const apply = (state: GameState, type: string) =>
    runtime.applyActions(state, [{ type, payload: {}, meta: { actorId: 1 } }], {
      actorId: 1,
      clock,
      rng: new StateGameRng(state),
    }) as DeclarativeState<object>;
  return { hooks, initial, apply, clock };
}

it('centralizes exit, timer cancellation, entry and phase events exactly once', () => {
  const { hooks, initial, apply, clock } = fixture();
  expect(hooks).toEqual(['first.enter']);
  expect(Object.keys(initial.engine.scheduler.tasks)).toEqual([
    'engine.phase.first',
  ]);
  const next = apply(initial, 'advance');
  expect(next.phase).toBe('second');
  expect(hooks).toEqual(['first.enter', 'first.exit', 'second.enter']);
  expect(Object.keys(next.engine.scheduler.tasks)).toEqual([
    'engine.phase.second',
  ]);
  clock.advanceBy(500);
  const repeated = apply(next, 'advance');
  expect(repeated.engine.scheduler).toEqual(next.engine.scheduler);
  expect(hooks).toEqual(['first.enter', 'first.exit', 'second.enter']);
  expect(
    repeated.engine.pendingEvents?.filter(
      (event) => event.type === 'game.phase.changed',
    ),
  ).toEqual(
    next.engine.pendingEvents?.filter(
      (event) => event.type === 'game.phase.changed',
    ),
  );
  expect(
    next.engine.pendingEvents?.filter(
      (event) => event.type === 'game.phase.changed',
    ),
  ).toHaveLength(1);
});

it('rejects a forbidden transition before exit hooks, timer removal or state changes', () => {
  const { hooks, initial, apply } = fixture();
  const state = apply(initial, 'advance');
  const before = JSON.stringify(state);
  expect(() => apply(state, 'rewind')).toThrow('Transition de phase interdite');
  expect(JSON.stringify(state)).toBe(before);
  expect(hooks).toEqual(['first.enter', 'first.exit', 'second.enter']);
});
