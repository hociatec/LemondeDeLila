import type { GameRuntime } from '../contracts/game-runtime.interface';
import type { GameStateEntity } from '../contracts/game-state.model';
import type {
  GameScheduledTask,
  GameTaskProcessor,
} from '../ports/game-task-scheduler.port';
import { GameRealtimeAutomationService } from './game-realtime-automation.service';

describe('GameRealtimeAutomationService', () => {
  const state = (overrides: Record<string, unknown> = {}) =>
    ({
      status: 'started',
      version: 4,
      players: [{ id: 1, username: 'Alice', isBot: false }],
      turn: { currentPlayerId: 1, direction: 1, turnNumber: 2 },
      metadata: {},
      ...overrides,
    }) as unknown as GameStateEntity;

  const handler = (executeAtMs = Date.now() - 1, actionType = 'resume') =>
    ({
      gameType: 'example',
      getAutomaticActions: () => ({
        key: 'pause:2',
        executeAtMs,
        actions: [{ type: actionType, payload: {} }],
      }),
    }) as unknown as GameRuntime;

  function harness(
    current = state(),
    runtime = handler(),
    suggestedActions: Array<{ type: string; payload: object }> = [],
  ) {
    let processor: GameTaskProcessor | undefined;
    const scheduled: GameScheduledTask[] = [];
    const scheduler = {
      registerProcessor: jest.fn((value: GameTaskProcessor) => {
        processor = value;
      }),
      schedule: jest.fn(async (task: GameScheduledTask) => {
        scheduled.push(task);
      }),
      cancel: jest.fn(async () => undefined),
      cancelRoom: jest.fn(async () => undefined),
    };
    const next = state({ version: 4, metadata: { resumed: true } });
    const engine = {
      exportInternalState: jest.fn().mockResolvedValue(current),
      compareAndSetInternalState: jest.fn().mockResolvedValue({
        committed: true,
        version: 5,
        state: { ...next, version: 5 },
      }),
    };
    const executor = { execute: jest.fn().mockReturnValue(next) };
    const queue = {
      run: jest.fn((_roomId: number, command: () => Promise<void>) =>
        command(),
      ),
    };
    const service = new GameRealtimeAutomationService(
      engine as never,
      {
        suggestForHandler: jest.fn().mockReturnValue(suggestedActions),
      } as never,
      scheduler,
      { getBotTurnDelayMs: () => 25 } as never,
      executor as never,
      queue as never,
      undefined,
      { getHandler: () => runtime } as never,
    );
    service.onModuleInit();
    return {
      service,
      scheduler,
      scheduled,
      engine,
      executor,
      queue,
      processor: () => processor!,
      runtime,
      current,
    };
  }

  it('persists a stable task identity and absolute deadline in the scheduler', async () => {
    const dueAtMs = Date.now() + 1_000;
    const test = harness(state(), handler(dueAtMs));
    test.service.schedule({
      roomId: 12,
      gameType: 'example',
      handler: test.runtime,
      state: test.current,
    });
    await Promise.resolve();
    expect(test.scheduled).toEqual([
      expect.objectContaining({
        key: 'game-realtime:12:example',
        roomId: 12,
        gameType: 'example',
        generation: 4,
        dueAtMs,
      }),
    ]);
  });

  it('executes a due task through the command executor and an atomic CAS', async () => {
    const test = harness();
    const committed = jest.fn();
    test.service.setStateCommittedHandler(committed);
    test.service.schedule({
      roomId: 12,
      gameType: 'example',
      handler: test.runtime,
      state: test.current,
    });
    await Promise.resolve();
    await test.processor()(test.scheduled[0]!);

    expect(test.queue.run).toHaveBeenCalledWith(12, expect.any(Function));

    expect(test.executor.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        handler: test.runtime,
        state: test.current,
        roomId: 12,
        actions: [
          expect.objectContaining({
            type: 'resume',
            meta: expect.objectContaining({ commandId: expect.any(String) }),
          }),
        ],
      }),
    );
    expect(test.engine.compareAndSetInternalState).toHaveBeenCalledWith(
      12,
      'example',
      4,
      expect.any(Object),
    );
    expect(committed).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 12,
        gameType: 'example',
        handler: test.runtime,
        version: 5,
      }),
    );
  });

  it('executes a bot task when its persisted deadline is due', async () => {
    const botState = state({
      players: [{ id: -7, username: 'Bot LAMA', isBot: true }],
      turn: { currentPlayerId: -7, direction: 1, turnNumber: 3 },
      engine: { round: { number: 2 } },
    });
    const runtime = {
      gameType: 'lama',
      getAutomaticActions: () => null,
    } as unknown as GameRuntime;
    const test = harness(botState, runtime, [{ type: 'draw', payload: {} }]);
    test.service.schedule({
      roomId: 12,
      gameType: 'lama',
      handler: runtime,
      state: botState,
    });
    await Promise.resolve();
    const task = test.scheduled[0]!;
    expect(task.signature).toBe('bot:-7:round:2:turn:3');
    task.dueAtMs = Date.now() - 1;

    await test.processor()(task);

    expect(test.executor.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: null,
        actions: [
          expect.objectContaining({
            type: 'draw',
            meta: expect.objectContaining({ actorId: -7 }),
          }),
        ],
      }),
    );
  });

  it('gives the same bot turn a distinct identity in the next round', async () => {
    const runtime = {
      gameType: 'lama',
      getAutomaticActions: () => null,
    } as unknown as GameRuntime;
    const test = harness(undefined, runtime, [{ type: 'draw', payload: {} }]);
    const botTurn = (round: number) =>
      state({
        players: [{ id: -7, username: 'Bot LAMA', isBot: true }],
        turn: { currentPlayerId: -7, direction: 1, turnNumber: 3 },
        engine: { round: { number: round } },
      });

    test.service.schedule({
      roomId: 12,
      gameType: 'lama',
      handler: runtime,
      state: botTurn(1),
    });
    test.service.schedule({
      roomId: 12,
      gameType: 'lama',
      handler: runtime,
      state: botTurn(2),
    });
    await Promise.resolve();

    expect(test.scheduled.map((task) => task.signature)).toEqual([
      'bot:-7:round:1:turn:3',
      'bot:-7:round:2:turn:3',
    ]);
  });

  it('makes a stale delivery harmless and replaces it from persisted state', async () => {
    const current = state({ version: 5 });
    const test = harness(current);
    await test.processor()({
      key: 'game-realtime:3:example',
      roomId: 3,
      gameType: 'example',
      signature: 'automatic:pause:2:round:0:turn:2',
      generation: 4,
      dueAtMs: Date.now() - 10,
    });
    await Promise.resolve();
    expect(test.executor.execute).not.toHaveBeenCalled();
    expect(test.scheduled.at(-1)).toEqual(
      expect.objectContaining({ generation: 5 }),
    );
  });

  it('allows a fresh service instance to process a task created before restart', async () => {
    const first = harness();
    first.service.schedule({
      roomId: 8,
      gameType: 'example',
      handler: first.runtime,
      state: first.current,
    });
    await Promise.resolve();
    const durableTask = structuredClone(first.scheduled[0]!);

    const restarted = harness(first.current, first.runtime);
    await restarted.processor()(durableTask);
    expect(restarted.engine.compareAndSetInternalState).toHaveBeenCalledTimes(
      1,
    );
  });

  it('commits only one transition when two workers deliver the same task', async () => {
    const test = harness();
    let committed = false;
    test.engine.compareAndSetInternalState.mockImplementation(
      async (_roomId, _gameType, _version, nextState) => {
        if (committed) {
          return { committed: false, version: 5, state: nextState };
        }
        committed = true;
        return { committed: true, version: 5, state: nextState };
      },
    );
    const task: GameScheduledTask = {
      key: 'game-realtime:9:example',
      roomId: 9,
      gameType: 'example',
      signature: 'automatic:pause:2:round:0:turn:2',
      generation: 4,
      dueAtMs: Date.now() - 1,
    };

    const results = await Promise.allSettled([
      test.processor()(task),
      test.processor()(task),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
  });

  it('processes tasks from different rooms independently', async () => {
    const test = harness();
    await Promise.all([
      test.processor()({
        key: 'game-realtime:20:example',
        roomId: 20,
        gameType: 'example',
        signature: 'automatic:pause:2:round:0:turn:2',
        generation: 4,
        dueAtMs: Date.now() - 1,
      }),
      test.processor()({
        key: 'game-realtime:21:example',
        roomId: 21,
        gameType: 'example',
        signature: 'automatic:pause:2:round:0:turn:2',
        generation: 4,
        dueAtMs: Date.now() - 1,
      }),
    ]);
    expect(test.engine.compareAndSetInternalState).toHaveBeenCalledTimes(2);
  });

  it('cancels all durable jobs for a room without a process-local timer map', async () => {
    const test = harness();
    test.service.clearRoom(42);
    await Promise.resolve();
    expect(test.scheduler.cancelRoom).toHaveBeenCalledWith(42);
  });
});
