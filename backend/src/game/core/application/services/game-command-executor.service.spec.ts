import type { GameRuntime } from '../ports/game-runtime.port';
import type { GameSingleActionDto } from '../models/game-action.model';
import type { GameState } from '../models/game-state.model';
import { FixedGameClock } from '../models/game-execution-context.model';
import { GameCommandExecutorService } from './game-command-executor.service';
import { GameExecutionScopeService } from './game-execution-scope.service';

function state(counter = 0): GameState {
  return {
    status: 'started',
    phase: 'turn',
    log: [],
    metadata: { rng: { seed: 42, counter: 0 } },
    game: { counter },
  };
}

function counterOf(state: GameState): number {
  return Number(
    (state as GameState & { game: { counter: number } }).game.counter,
  );
}

describe('GameCommandExecutorService', () => {
  const executor = new GameCommandExecutorService(
    new GameExecutionScopeService(),
  );

  it('validates and applies every batch action against the preceding result', () => {
    const validatedCounters: number[] = [];
    const handler = {
      validateActor: () => true,
      validateAction: (current: GameState, action: GameSingleActionDto) => {
        validatedCounters.push(counterOf(current));
        return action;
      },
      applyActions: (current: GameState) => ({
        ...current,
        game: { counter: counterOf(current) + 1 },
      }),
    } as unknown as GameRuntime;

    const next = executor.execute({
      handler,
      state: state(),
      actions: [{ type: 'increment' }, { type: 'increment' }],
      actorId: 7,
    });

    expect(validatedCounters).toEqual([0, 1]);
    expect(counterOf(next)).toBe(2);
  });

  it('does not mutate the input when a later action is rejected', () => {
    const initial = state();
    const handler = {
      validateActor: () => true,
      validateAction: (_current: GameState, action: GameSingleActionDto) => {
        if (action.type === 'reject') throw new Error('rejected');
        return action;
      },
      applyActions: (current: GameState) => {
        (current as GameState & { game: { counter: number } }).game.counter +=
          1;
        return current;
      },
    } as unknown as GameRuntime;

    expect(() =>
      executor.execute({
        handler,
        state: initial,
        actions: [{ type: 'increment' }, { type: 'reject' }],
        actorId: 7,
      }),
    ).toThrow('rejected');
    expect(counterOf(initial)).toBe(0);
  });

  it('provides reproducible RNG and a controlled clock', () => {
    const execution = new GameExecutionScopeService();
    const initialA = state();
    const initialB = state();
    const run = (current: GameState) => {
      const context = execution.create(current, 4, new FixedGameClock(1234));
      return execution.run(context, () => ({
        random: context.rng.int(1000),
        now: context.clock.nowMs(),
      }));
    };

    expect(run(initialA)).toEqual(run(initialB));
    expect(run(state()).now).toBe(1234);
  });

  it('clones the accepted action once at the event boundary', () => {
    const initial = state();
    const handler = {
      validateActor: () => true,
      validateAction: (_current: GameState, action: GameSingleActionDto) =>
        action,
      applyActions: (current: GameState, actions: GameSingleActionDto[]) => {
        actions[0]!.payload = { mutatedAfterAcceptance: true };
        return current;
      },
    } as unknown as GameRuntime;

    const next = executor.execute({
      handler,
      state: initial,
      actions: [{ type: 'change', payload: { original: true } }],
      actorId: 7,
    });

    expect(
      (
        next as GameState & {
          engine?: { pendingEvents?: readonly unknown[] };
        }
      ).engine?.pendingEvents?.[0],
    ).toMatchObject({
      type: 'game.command.accepted',
      data: {
        actionType: 'change',
      },
      visibility: {
        privateDataByPlayer: {
          '7': {
            action: { type: 'change', payload: { original: true } },
          },
        },
      },
    });
  });
});
