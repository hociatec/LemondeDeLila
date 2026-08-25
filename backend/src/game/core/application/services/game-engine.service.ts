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

  async clearInternalStateIf(
    roomId: number,
    gameType: string,
    expected: GameStateEntity,
  ): Promise<void> {
    const key = this.key(roomId, gameType);
    if (this.snapshots.get(key) === expected) this.snapshots.delete(key);
  }

  async clearRoom(roomId: number): Promise<void> {
    const prefix = `${roomId}:`;
    for (const key of this.snapshots.keys()) {
      if (key.startsWith(prefix)) this.snapshots.delete(key);
    }
  }

  private key(roomId: number, gameType: string): string {
    return `${roomId}:${gameType}`;
  }
}
