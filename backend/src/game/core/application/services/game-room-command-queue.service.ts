import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  GAME_ROOM_LOCK,
  type GameRoomLock,
} from '../ports/game-room-lock.port';

export const GAME_ROOM_COORDINATION_STRATEGY = Object.freeze({
  local: 'promise-tail-per-room',
  distributed: 'mysql-named-lock-per-room',
  commit: 'transactional-database-cas',
  responsibilities: Object.freeze({
    local: 'preserve-order-and-limit-work-inside-one-process',
    distributed: 'avoid-concurrent-room-work-across-processes',
    commit: 'authoritative-correctness-and-version-conflict-detection',
  }),
});

@Injectable()
export class GameRoomCommandQueueService {
  private readonly tails = new Map<number, Promise<void>>();

  constructor(
    @Optional()
    @Inject(GAME_ROOM_LOCK)
    private readonly distributedLock?: GameRoomLock,
  ) {}

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
    return this.distributedLock
      ? this.distributedLock.runExclusive(roomId, command)
      : command();
  }
}
