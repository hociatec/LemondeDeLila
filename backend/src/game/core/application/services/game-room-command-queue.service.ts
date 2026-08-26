import { Injectable } from '@nestjs/common';

@Injectable()
export class GameRoomCommandQueueService {
  private readonly tails = new Map<number, Promise<void>>();

  run<T>(roomId: number, command: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(roomId) ?? Promise.resolve();
    const result = previous.then(command, command);
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
}
