import type { GameRulesAdapter } from '../../../application/contracts/game-rules-adapter.interface';
import type { GameStateEntity } from '../../../application/models/game-state.model';
import { GameWsRealtimeStateService } from './game-ws-realtime-state.service';

describe('GameWsRealtimeStateService run isolation', () => {
  const roomPayload = (runId: number) => ({
    room: { id: 4, gameType: 'lama', status: 'started', runId },
  });

  it('discards a snapshot from the previous room run', async () => {
    const stale = {
      status: 'started',
      metadata: { roomRunId: 1 },
      log: [{ message: 'Ancienne partie.' }],
    } as GameStateEntity;
    const base = {
      status: 'started',
      metadata: { roomRunId: 2 },
      log: [],
    } as GameStateEntity;
    const fresh = { ...base } as GameStateEntity;
    const handler = {
      hydrateInitialState: jest.fn().mockReturnValue(fresh),
    } as unknown as GameRulesAdapter;
    const engine = {
      exportInternalState: jest.fn().mockResolvedValue(stale),
      clearInternalState: jest.fn().mockResolvedValue(undefined),
      restoreInternalState: jest.fn().mockResolvedValue(undefined),
    };
    const automation = { clear: jest.fn() };
    const service = new GameWsRealtimeStateService(
      { buildBaseState: jest.fn().mockReturnValue(base) } as never,
      engine as never,
      { getHandler: jest.fn().mockReturnValue(handler) } as never,
      automation as never,
      {} as never,
      {} as never,
      { buildPayload: jest.fn().mockResolvedValue(roomPayload(2)) } as never,
    );

    const resolved = await service.resolve(4);

    expect(automation.clear).toHaveBeenCalledWith(4, 'lama');
    expect(engine.clearInternalState).toHaveBeenCalledWith(4, 'lama');
    expect(handler.hydrateInitialState).toHaveBeenCalledWith(base);
    expect(engine.restoreInternalState).toHaveBeenCalledWith(4, 'lama', fresh);
    expect(resolved.state).toBe(fresh);
  });

  it('keeps a snapshot belonging to the current room run', async () => {
    const current = {
      status: 'started',
      metadata: { roomRunId: 2 },
      log: [{ message: 'Partie actuelle.' }],
    } as GameStateEntity;
    const engine = {
      exportInternalState: jest.fn().mockResolvedValue(current),
    };
    const handler = {} as GameRulesAdapter;
    const automation = { clear: jest.fn() };
    const service = new GameWsRealtimeStateService(
      {} as never,
      engine as never,
      { getHandler: jest.fn().mockReturnValue(handler) } as never,
      automation as never,
      {} as never,
      {} as never,
      { buildPayload: jest.fn().mockResolvedValue(roomPayload(2)) } as never,
    );

    const resolved = await service.resolve(4);

    expect(resolved.state).toBe(current);
    expect(automation.clear).not.toHaveBeenCalled();
  });
});
