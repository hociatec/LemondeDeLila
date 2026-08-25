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

  it('preserves the run marker when a game replaces metadata during hydration', async () => {
    const base = {
      status: 'started',
      metadata: { roomRunId: 2 },
    } as GameStateEntity;
    const fresh = {
      status: 'started',
      metadata: { step: 'setup_config' },
    } as GameStateEntity;
    const handler = {
      hydrateInitialState: jest.fn().mockReturnValue(fresh),
    } as unknown as GameRulesAdapter;
    const engine = {
      exportInternalState: jest.fn().mockResolvedValue(null),
      restoreInternalState: jest.fn().mockResolvedValue(undefined),
    };
    const service = new GameWsRealtimeStateService(
      { buildBaseState: jest.fn().mockReturnValue(base) } as never,
      engine as never,
      { getHandler: jest.fn().mockReturnValue(handler) } as never,
      {} as never,
      {} as never,
      {} as never,
      { buildPayload: jest.fn().mockResolvedValue(roomPayload(2)) } as never,
    );

    const resolved = await service.resolve(4);

    expect((resolved.state.metadata as any)?.step).toBe('setup_config');
    expect((resolved.state.metadata as any)?.roomRunId).toBe(2);
    expect(engine.restoreInternalState).toHaveBeenCalledWith(4, 'lama', fresh);
  });

  it('preserves the run marker when an action replaces metadata', async () => {
    const previous = {
      status: 'started',
      version: 4,
      metadata: { roomRunId: 2, step: 'setup_config' },
    } as GameStateEntity;
    const next = {
      status: 'started',
      metadata: { step: 'turn_choice' },
    } as GameStateEntity;
    const handler = {} as GameRulesAdapter;
    const engine = {
      restoreInternalState: jest.fn().mockResolvedValue(undefined),
    };
    const automation = { schedule: jest.fn() };
    const service = new GameWsRealtimeStateService(
      {} as never,
      engine as never,
      {} as never,
      automation as never,
      {} as never,
      { listConnections: jest.fn().mockReturnValue([]) } as never,
      {} as never,
    );

    await service.commit(
      4,
      { gameType: 'lama', state: previous, handler },
      previous,
      next,
    );

    expect((next.metadata as any)?.step).toBe('turn_choice');
    expect((next.metadata as any)?.roomRunId).toBe(2);
    expect((next as any).version).toBe(5);
    expect(engine.restoreInternalState).toHaveBeenCalledWith(4, 'lama', next);
  });
});
