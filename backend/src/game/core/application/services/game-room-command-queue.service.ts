import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  GAME_ROOM_COMMAND_SCOPE,
  GameRoomNestedCommandError,
  type GameRoomCommandScope,
} from '../ports/game-room-command-scope.port';
import {
  GAME_ROOM_LOCK,
  type GameRoomLock,
} from '../ports/game-room-lock.port';

export const GAME_ROOM_COORDINATION_STRATEGY = Object.freeze({
  local: 'promise-tail-per-room',
  distributed: 'mysql-named-lock-per-room',
  commit: 'transactional-database-cas',
  nesting: 'one-room-per-command-no-nested-acquisition',
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
    @Inject(GAME_ROOM_COMMAND_SCOPE)
    private readonly scope: GameRoomCommandScope,
    @Optional()
    @Inject(GAME_ROOM_LOCK)
    private readonly distributedLock?: GameRoomLock,
  ) {}

  run<T>(roomId: number, command: () => Promise<T>): Promise<T> {
    if (!Number.isSafeInteger(roomId) || roomId <= 0) {
      return Promise.reject(new RangeError('Identifiant de room invalide'));
    }
    const heldRoomId = this.scope.currentRoom();
    if (heldRoomId !== null) {
      return Promise.reject(new GameRoomNestedCommandError(heldRoomId, roomId));
    }
    const previous = this.tails.get(roomId) ?? Promise.resolve();
    const execute = () =>
      this.scope.run(roomId, () =>
        this.runWithDistributedRoomLock(roomId, command),
      );
    const result = previous.then(execute, execute);
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    this.tails.set(roomId, tail);
    return result.finally(() => {
      if (this.tails.get(roomId) === tail) this.tails.delete(roomId);
    });
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
