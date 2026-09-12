import { ApplicationShutdownService } from '../../../../platform/lifecycle/public-api';
import type { GameState } from '../../application/models/game-state.model';
import { InMemoryGameSessionStore } from '../persistence/memory/in-memory-game-session.store';
import { GameAutomationRecoveryService } from './game-automation-recovery.service';

it.each([false, true])(
  'preserves a concurrent replacement: %s',
  async (replace) => {
    const store = new InMemoryGameSessionStore();
    const state: GameState = {
      status: 'started',
      phase: 'playing',
      log: [],
      version: 1,
      metadata: { roomRunId: 1 },
    };
    const original = await store.restore(1, 'example', state);
    let replacement: GameState | undefined;
    const rooms = {
      isCurrent: async () => {
        if (replace && !replacement)
          replacement = await store.restore(1, 'example', {
            ...state,
            metadata: { roomRunId: 2 },
          });
        return false;
      },
    };
    const clear = jest.fn(
      async (roomId: number, gameType: string, expected: GameState) => {
        await store.clearIfVersion(
          roomId,
          gameType,
          expected.version ?? 0,
          expected.metadata?.restoreId ?? null,
        );
      },
    );
    const recovery = new GameAutomationRecoveryService(
      { listAfter: async () => [{ roomId: 1, gameType: 'example' }] },
      {
        exportInternalState: (roomId, gameType) => store.load(roomId, gameType),
        clearInternalStateIf: clear,
      },
      { getHandler: () => undefined },
      { schedule: jest.fn() },
      new ApplicationShutdownService(),
      rooms,
    );
    await recovery.recover();
    expect(clear).toHaveBeenCalledWith(1, 'example', original);
    expect(await store.load(1, 'example')).toEqual(
      replace ? replacement : null,
    );
    if (!replace) {
      await recovery.recover();
      expect(clear).toHaveBeenCalledTimes(1);
      expect(await store.latestSnapshot(1, 'example')).toBeNull();
    }
  },
);
