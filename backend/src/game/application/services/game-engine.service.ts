import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../models/game-state.model';

@Injectable()
export class GameEngineService {
  private readonly snapshots = new Map<string, GameStateEntity>();

  async exportInternalState(
    roomId: number,
    gameType: string,
  ): Promise<GameStateEntity | null> {
    return this.snapshots.get(this.key(roomId, gameType)) ?? null;
  }

  async restoreInternalState(
    roomId: number,
    gameType: string,
    state: GameStateEntity,
  ): Promise<void> {
    this.snapshots.set(this.key(roomId, gameType), state);
  }

  async clearInternalState(roomId: number, gameType: string): Promise<void> {
    this.snapshots.delete(this.key(roomId, gameType));
  }

  private key(roomId: number, gameType: string): string {
    return `${roomId}:${gameType}`;
  }
}
