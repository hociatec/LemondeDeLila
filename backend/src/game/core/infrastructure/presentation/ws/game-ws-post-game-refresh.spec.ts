import { GameRoomCommandQueueService } from '../../../application/services/game-room-command-queue.service';
import { GameWsHandler } from './game-ws.handler';

describe('post-game refresh from two human players', () => {
  it('waits for the finishing command and serializes next-run initialization', async () => {
    const queue = new GameRoomCommandQueueService({
      currentRoom: () => null,
      run: (_roomId, operation) => operation(),
    });
    let finish!: () => void;
    const finished = new Promise<void>((resolve) => {
      finish = resolve;
    });
    let preparingNextRun = true;
    const finishingCommand = queue.run(4, async () => {
      await finished;
      preparingNextRun = false;
    });
    let resolving = false;
    let initialized = false;
    const realtime = {
      resolve: jest.fn(async () => {
        expect(preparingNextRun).toBe(false);
        expect(resolving).toBe(false);
        resolving = true;
        await Promise.resolve();
        initialized = true;
        resolving = false;
        return { gameType: 'test', state: { version: 1 } };
      }),
      bind: jest.fn(),
      schedule: jest.fn(),
      present: jest.fn((_resolved, _roomId, userId) => ({ userId })),
    };
    const handler = new GameWsHandler(
      {} as never,
      {} as never,
      {} as never,
      { resolveRoomId: () => 4 } as never,
      realtime as never,
      { ensureReadable: jest.fn().mockResolvedValue(undefined) } as never,
      {} as never,
      queue,
    );
    const ownerRefresh = handler.state({ user: { id: 7 } } as never, {});
    const guestRefresh = handler.state({ user: { id: 8 } } as never, {});
    await Promise.resolve();
    expect(realtime.resolve).not.toHaveBeenCalled();
    finish();
    const [, owner, guest] = await Promise.all([
      finishingCommand,
      ownerRefresh,
      guestRefresh,
    ]);
    expect(initialized).toBe(true);
    expect(realtime.resolve).toHaveBeenCalledTimes(2);
    expect(owner).toEqual({ type: 'game.state', payload: { userId: 7 } });
    expect(guest).toEqual({ type: 'game.state', payload: { userId: 8 } });
  });
});
