import { Injectable } from '@nestjs/common';

@Injectable()
export class PendingActionService<TAction = unknown> {
  private pending: Record<number, TAction | undefined> = {};

  set(playerId: number, action: TAction): void {
    this.pending[playerId] = action;
  }

  get(playerId: number): TAction | undefined {
    return this.pending[playerId];
  }

  clear(playerId: number): void {
    delete this.pending[playerId];
  }
}
