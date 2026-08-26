import { GameRoomCommandQueueService } from './game-room-command-queue.service';

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
});
