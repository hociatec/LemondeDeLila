import { defineGame } from '../definitions/game-definition';
import {
  defineAction,
  defineChoice,
} from '../definitions/game-definition-builders';
import { gameInput } from '../actions/game-input-schema';
import { DeclarativeGameRuntime } from '../declarative-game.runtime';
import { FixedGameClock } from '../../../core/application/models/game-execution-context.model';
import { GameExecutionScopeService } from '../../../core/application/services/game-execution-scope.service';
import { GameCommandExecutorService } from '../../../core/application/services/game-command-executor.service';
import { createTestGameState } from '../../../core/testing/game-test-state';

it('uses one supplied clock for enumeration, validation, execution and timer views', () => {
  const definition = defineGame<{ count: number }>()({
    id: 'clock-contract',
    displayName: 'Clock',
    category: 'test',
    players: { min: 1, max: 1 },
    setup: ({ ctx }) => {
      ctx.scheduler.schedule('gate', { afterMs: 10 });
      return { count: 0 };
    },
    actions: {
      increment: defineAction<{ count: number }, Record<string, never>>({
        input: gameInput.object({}),
        available: ({ ctx }) => ctx.scheduler.isDue('gate'),
        execute: ({ state, ctx }) => {
          expect(ctx.clock.nowMs()).toBe(110);
          state.count++;
        },
      }),
    },
  });
  const runtime = new DeclarativeGameRuntime(definition);
  const scope = new GameExecutionScopeService();
  const clock = new FixedGameClock(100);
  const base = createTestGameState({
    definition,
    players: ['Alice'],
    seed: 1,
    startedAt: clock.nowIso(),
  });
  const context = scope.create(base, 1, clock);
  const initial = runtime.hydrateInitialState(base, context);
  const command = { type: 'increment', payload: {} };
  const executor = new GameCommandExecutorService(scope);
  expect(runtime.getAvailableActions(initial, 1, context)).toEqual([]);
  expect(runtime.exposeStateForUser(initial, 1, context).timers).toMatchObject({
    gate: { remainingMs: 10 },
  });
  expect(() =>
    executor.execute({
      handler: runtime,
      state: initial,
      actions: [command],
      actorId: 1,
      clock,
    }),
  ).toThrow();
  clock.advanceBy(10);
  expect(runtime.getAvailableActions(initial, 1, context)).toHaveLength(1);
  expect(
    runtime.getActionCandidates(initial, 1, 'increment', {}, context).items,
  ).toHaveLength(1);
  expect(
    executor.execute({
      handler: runtime,
      state: initial,
      actions: [command],
      actorId: 1,
      clock,
    }).game,
  ).toEqual({ count: 1 });
  expect(runtime.exposeStateForUser(initial, 1, context).timers).toMatchObject({
    gate: { remainingMs: 0 },
  });
});

it('keeps author continuation data out of the public pending view', () => {
  const definition = defineGame<object>()({
    id: 'private-continuation',
    displayName: 'Private continuation',
    category: 'test',
    players: { min: 1, max: 1 },
    setup: ({ ctx }) => {
      ctx.choice.one({
        id: 'pick',
        player: 1,
        options: ['a'],
        data: { secret: 'server-only', kind: 'author-intent' },
      });
      return {};
    },
    choices: {
      pick: defineChoice({ input: gameInput.string(), resolve: () => {} }),
    },
    actions: {
      pass: defineAction({ input: gameInput.object({}), execute: () => {} }),
    },
  });
  const runtime = new DeclarativeGameRuntime(definition);
  const scope = new GameExecutionScopeService();
  const clock = new FixedGameClock(100);
  const base = createTestGameState({
    definition,
    players: ['Alice'],
    seed: 1,
    startedAt: clock.nowIso(),
  });
  const context = scope.create(base, 1, clock);
  const state = runtime.hydrateInitialState(base, context);
  expect(state.pending?.data?.continuationData).toEqual({
    secret: 'server-only',
    kind: 'author-intent',
  });
  const view = runtime.exposeStateForUser(state, 1, context);
  expect(view.pending?.data).toMatchObject({ kind: 'one', options: ['a'] });
  expect(JSON.stringify(view)).not.toContain('server-only');
  expect(JSON.stringify(view)).not.toContain('continuationData');
});
