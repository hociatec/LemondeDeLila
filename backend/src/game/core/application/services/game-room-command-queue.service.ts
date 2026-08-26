import { Injectable, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';

export const GAME_ROOM_COORDINATION_STRATEGY = Object.freeze({
  local: 'promise-tail-per-room',
  distributed: 'postgres-advisory-lock-per-room',
  commit: 'database-cas',
});

@Injectable()
export class GameRoomCommandQueueService {
  private readonly tails = new Map<number, Promise<void>>();

  constructor(@Optional() private readonly dataSource?: DataSource) {}

  run<T>(roomId: number, command: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(roomId) ?? Promise.resolve();
    const execute = () => this.runWithDistributedRoomLock(roomId, command);
    const result = previous.then(execute, execute);
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    this.tails.set(roomId, tail);
    void tail.finally(() => {
      if (this.tails.get(roomId) === tail) this.tails.delete(roomId);
    });
    return result;
  }

  hasPending(roomId: number): boolean {
    return this.tails.has(roomId);
  }

  private async runWithDistributedRoomLock<T>(
    roomId: number,
    command: () => Promise<T>,
  ): Promise<T> {
    if (!this.dataSource || this.dataSource.options.type !== 'postgres') {
      return command();
    }
    const connection = this.dataSource.createQueryRunner();
    await connection.connect();
    let locked = false;
    try {
      await connection.query('SELECT pg_advisory_lock($1)', [roomId]);
      locked = true;
      return await command();
    } finally {
      if (locked) {
        await connection.query('SELECT pg_advisory_unlock($1)', [roomId]);
      }
      await connection.release();
    }
  }
}
