import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { GameRoomCommandScope } from '../../application/ports/game-room-command-scope.port';

@Injectable()
export class AsyncGameRoomCommandScope implements GameRoomCommandScope {
  private readonly storage = new AsyncLocalStorage<{
    roomId: number;
    active: boolean;
  }>();

  currentRoom(): number | null {
    const scope = this.storage.getStore();
    return scope?.active ? scope.roomId : null;
  }

  run<T>(roomId: number, operation: () => Promise<T>): Promise<T> {
    const scope = { roomId, active: true };
    return this.storage.run(scope, async () => {
      try {
        return await operation();
      } finally {
        scope.active = false;
      }
    });
  }
}
