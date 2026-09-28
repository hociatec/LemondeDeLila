import type { GameRuntime } from '../ports/game-runtime.port';
import type { GameState } from '../models/game-state.model';
import { GameRoomStateLifecycle } from './game-room-state-lifecycle';

describe('GameRoomStateLifecycle', () => {
  it('never publishes a player command whose durable CAS was rejected', async () => {
    const publish = jest.fn();
    const previous: GameState = {
      status: 'started',
      phase: 'playing',
      version: 4,
      log: [],
      metadata: { restoreId: 'restore-4', roomRunId: 7 },
    };
    const engine = {
      compareAndSetInternalState: jest.fn().mockResolvedValue({
        committed: false,
        version: 4,
        state: previous,
      }),
    };
    const lifecycle = new GameRoomStateLifecycle(
      {} as never,
      engine as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      publish,
    );
    const resolved = {
      gameType: 'example',
      state: previous,
      handler: {} as GameRuntime,
    };

    await expect(
      lifecycle.commit(12, resolved, previous, structuredClone(previous)),
    ).rejects.toThrow('État modifié par une commande concurrente');
    expect(engine.compareAndSetInternalState).toHaveBeenCalledWith(
      12,
      'example',
      4,
      expect.any(Object),
      'restore-4',
    );
    expect(publish).not.toHaveBeenCalled();
  });
});
