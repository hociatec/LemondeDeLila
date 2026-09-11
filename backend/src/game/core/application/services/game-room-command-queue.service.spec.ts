import { GameRoomCommandQueueService } from './game-room-command-queue.service';
import type { GameRoomLock } from '../ports/game-room-lock.port';
import { GameRoomNestedCommandError } from '../ports/game-room-command-scope.port';
import { AsyncGameRoomCommandScope } from '../../infrastructure/scheduling/async-game-room-command-scope';

class SharedTestRoomLock implements GameRoomLock {
  private readonly tails = new Map<number, Promise<void>>();

  async runExclusive<T>(
    roomId: number,
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous = this.tails.get(roomId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.tails.set(roomId, current);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.tails.get(roomId) === current) this.tails.delete(roomId);
    }
  }
}

describe('GameRoomCommandQueueService', () => {
  it('serializes commands of one room while keeping rooms independent', async () => {
    const queue = new GameRoomCommandQueueService(
      new AsyncGameRoomCommandScope(),
    );
    const order: string[] = [];
    let releaseFirst!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = queue.run(1, async () => {
      order.push('room-1:first:start');
      await gate;
      order.push('room-1:first:end');
    });
    const second = queue.run(1, async () => {
      order.push('room-1:second');
    });
    const otherRoom = queue.run(2, async () => {
      order.push('room-2');
    });

    await otherRoom;
    expect(order).toEqual(['room-1:first:start', 'room-2']);
    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual([
      'room-1:first:start',
      'room-2',
      'room-1:first:end',
      'room-1:second',
    ]);
  });

  it('serializes one room across two backend queue instances', async () => {
    const lock = new SharedTestRoomLock();
    const firstInstance = new GameRoomCommandQueueService(
      new AsyncGameRoomCommandScope(),
      lock,
    );
    const secondInstance = new GameRoomCommandQueueService(
      new AsyncGameRoomCommandScope(),
      lock,
    );
    const order: string[] = [];
    let releaseFirst!: () => void;
    let markFirstStarted!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });

    const first = firstInstance.run(7, async () => {
      order.push('instance-a:start');
      markFirstStarted();
      await gate;
      order.push('instance-a:end');
    });
    const second = secondInstance.run(7, async () => {
      order.push('instance-b');
    });

    await firstStarted;
    expect(order).toEqual(['instance-a:start']);
    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(['instance-a:start', 'instance-a:end', 'instance-b']);
  });

  it.each([1, 2])(
    'rejects nested acquisition of room %s before queuing',
    async (requestedRoom) => {
      const scope = new AsyncGameRoomCommandScope();
      const lock = {
        runExclusive: jest.fn(async (_room, operation) => operation()),
      };
      const queue = new GameRoomCommandQueueService(scope, lock);
      const nested = jest.fn();
      await queue.run(1, async () => {
        await Promise.resolve();
        await expect(queue.run(requestedRoom, nested)).rejects.toBeInstanceOf(
          GameRoomNestedCommandError,
        );
      });
      expect(nested).not.toHaveBeenCalled();
      expect(lock.runExclusive).toHaveBeenCalledTimes(1);
      expect(queue.hasPending(1)).toBe(false);
      await expect(queue.run(1, async () => 'next')).resolves.toBe('next');
    },
  );

  it('does not retain a completed command scope in a detached continuation', async () => {
    const queue = new GameRoomCommandQueueService(
      new AsyncGameRoomCommandScope(),
    );
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let continuation!: Promise<string>;
    await queue.run(1, async () => {
      continuation = gate.then(() => queue.run(2, async () => 'later'));
    });
    release();
    await expect(continuation).resolves.toBe('later');
  });
});
