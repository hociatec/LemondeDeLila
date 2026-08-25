import type { GameRulesAdapter } from '../contracts/game-rules-adapter.interface';
import type { GameStateEntity } from '../models/game-state.model';
import { GameRealtimeAutomationService } from './game-realtime-automation.service';

describe('GameRealtimeAutomationService', () => {
  const state = (overrides: Record<string, unknown> = {}) =>
    ({
      status: 'started',
      phase: 'turn',
      turnIndex: 3,
      players: [],
      turn: { currentPlayerId: null, direction: 1 },
      metadata: {},
      ...overrides,
    }) as unknown as GameStateEntity;

  it('executes an automatic transition declared by the game adapter', async () => {
    let scheduled: { delayMs: number; run: () => Promise<void> } | undefined;
    const current = state({ metadata: { step: 'pause' } });
    const next = state({ turnIndex: 4 });
    const engine = {
      exportInternalState: jest.fn().mockResolvedValue(current),
    };
    const scheduler = {
      clear: jest.fn(),
      has: jest.fn().mockReturnValue(false),
      schedule: jest.fn((plan) => {
        scheduled = plan;
      }),
    };
    const applyActions = jest.fn().mockReturnValue(next);
    const handler = {
      getAutomaticActions: () => ({
        key: 'pause:1',
        executeAtMs: Date.now(),
        actions: [{ type: 'resume', payload: {} }],
      }),
      applyActions,
    } as unknown as GameRulesAdapter;
    const commit = jest.fn().mockResolvedValue(undefined);
    const service = new GameRealtimeAutomationService(
      engine as never,
      { suggestForHandler: jest.fn() } as never,
      scheduler as never,
      { getBotTurnDelayMs: () => 10 } as never,
    );

    service.schedule({
      roomId: 12,
      gameType: 'example',
      handler,
      state: current,
      commit,
    });
    expect(scheduler.clear).toHaveBeenCalledWith('game-realtime:12:example');
    expect(scheduled).toBeDefined();
    await scheduled!.run();

    expect(applyActions).toHaveBeenCalledWith(current, [
      { type: 'resume', payload: {} },
    ]);
    expect(commit).toHaveBeenCalledWith(current, next);
  });

  it('runs a bot suggestion with the bot actor id', async () => {
    let run: (() => Promise<void>) | undefined;
    const current = state({
      players: [{ id: 9, username: 'Bot', isBot: true }],
      turn: { currentPlayerId: 9, direction: 1 },
    });
    const applyActions = jest.fn().mockReturnValue(current);
    const handler = {
      applyActions,
    } as unknown as GameRulesAdapter;
    const service = new GameRealtimeAutomationService(
      { exportInternalState: jest.fn().mockResolvedValue(current) } as never,
      {
        suggestForHandler: jest
          .fn()
          .mockReturnValue([{ type: 'draw', payload: {} }]),
      } as never,
      {
        clear: jest.fn(),
        has: jest.fn().mockReturnValue(false),
        schedule: jest.fn((plan) => {
          run = plan.run;
        }),
      } as never,
      { getBotTurnDelayMs: () => 25 } as never,
    );

    service.schedule({
      roomId: 4,
      gameType: 'example',
      handler,
      state: current,
      commit: jest.fn().mockResolvedValue(undefined),
    });
    await run!();

    expect(applyActions).toHaveBeenCalledWith(current, [
      { type: 'draw', payload: {}, meta: { actorId: 9 } },
    ]);
  });

  it('does not postpone an unchanged plan when state is requested again', () => {
    const current = state();
    const scheduler = {
      clear: jest.fn(),
      has: jest.fn().mockReturnValue(true),
      schedule: jest.fn(),
    };
    const handler = {
      getAutomaticActions: () => ({
        key: 'pause:1',
        executeAtMs: Date.now() + 1000,
        actions: [{ type: 'resume', payload: {} }],
      }),
    } as unknown as GameRulesAdapter;
    const service = new GameRealtimeAutomationService(
      {} as never,
      {} as never,
      scheduler as never,
      {} as never,
    );
    const input = {
      roomId: 1,
      gameType: 'example',
      handler,
      state: current,
      commit: jest.fn(),
    };

    service.schedule(input);
    service.schedule(input);

    expect(scheduler.schedule).toHaveBeenCalledTimes(1);
    expect(scheduler.clear).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending bot action when its room is reset', async () => {
    let run: (() => Promise<void>) | undefined;
    const current = state({
      players: [{ id: 9, username: 'Bot', isBot: true }],
      turn: { currentPlayerId: 9, direction: 1 },
    });
    const applyActions = jest.fn().mockReturnValue(current);
    const scheduler = {
      clear: jest.fn(),
      has: jest.fn().mockReturnValue(false),
      schedule: jest.fn((plan) => {
        run = plan.run;
      }),
    };
    const service = new GameRealtimeAutomationService(
      { exportInternalState: jest.fn().mockResolvedValue(current) } as never,
      {
        suggestForHandler: jest
          .fn()
          .mockReturnValue([{ type: 'draw', payload: {} }]),
      } as never,
      scheduler as never,
      { getBotTurnDelayMs: () => 25 } as never,
    );

    service.schedule({
      roomId: 4,
      gameType: 'lama',
      handler: { applyActions } as unknown as GameRulesAdapter,
      state: current,
      commit: jest.fn(),
    });
    service.clearRoom(4);
    await run!();

    expect(scheduler.clear).toHaveBeenCalledWith('game-realtime:4:lama');
    expect(applyActions).not.toHaveBeenCalled();
  });
});
