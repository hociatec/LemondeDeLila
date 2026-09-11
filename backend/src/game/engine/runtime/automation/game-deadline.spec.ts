import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import { gameDeadline, MAX_GAME_TIMESTAMP_MS } from './game-deadline';
import {
  createGameSchedulerState,
  GameSchedulerController,
} from './scheduler-kit';
import { assertGameScheduler } from './scheduler-contracts';

it.each([-Infinity, Infinity, NaN, -1, 0.5, Number.MAX_SAFE_INTEGER])(
  'rejects invalid delays without replacing an existing task: %s',
  (afterMs) => {
    const state = createGameSchedulerState();
    const emit = jest.fn();
    const scheduler = new GameSchedulerController(state, () => 100, emit);
    scheduler.schedule('turn', { afterMs: 20 });
    const before = structuredClone(state);
    emit.mockClear();
    expect(() => scheduler.schedule('turn', { afterMs })).toThrow(
      GameConfigurationError,
    );
    expect(state).toEqual(before);
    expect(emit).not.toHaveBeenCalled();
  },
);

it('checks addition before publishing the deadline and accepts the exact boundary', () => {
  expect(gameDeadline(MAX_GAME_TIMESTAMP_MS - 1, 1)).toBe(
    MAX_GAME_TIMESTAMP_MS,
  );
  expect(() => gameDeadline(MAX_GAME_TIMESTAMP_MS, 1)).toThrow(
    GameConfigurationError,
  );
  expect(() => gameDeadline(NaN, 0)).toThrow(GameConfigurationError);
  expect(gameDeadline(-1, 1)).toBe(0);
});

it.each([0.5, MAX_GAME_TIMESTAMP_MS + 1])(
  'rejects out-of-contract restored deadlines: %s',
  (dueAtMs) => {
    expect(() =>
      assertGameScheduler({
        tasks: {
          turn: {
            id: 'turn',
            dueAtMs,
            visibility: { kind: 'public' },
          },
        },
      }),
    ).toThrow();
  },
);
