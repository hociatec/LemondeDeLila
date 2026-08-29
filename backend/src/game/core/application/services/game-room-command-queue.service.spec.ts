import { GameRoomCommandQueueService } from './game-room-command-queue.service';
import type { GameRoomLock } from '../ports/game-room-lock.port';

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
    const queue = new GameRoomCommandQueueService();
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
    const firstInstance = new GameRoomCommandQueueService(lock);
    const secondInstance = new GameRoomCommandQueueService(lock);
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
});
