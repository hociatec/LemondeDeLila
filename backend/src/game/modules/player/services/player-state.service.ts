import { Injectable } from '@nestjs/common';
import { GameStateEntity, PlayerStateEntity } from '../../../core/entities/game-state.entity';

@Injectable()
export class PlayerStateService {
  isAlive(state: GameStateEntity, playerId: number | null | undefined): boolean {
    if (playerId == null) return false;
    const player = (state.players ?? []).find((p) => p.id === playerId);
    return Boolean(player && (player as any).alive !== false);
  }

  kill(state: GameStateEntity, playerId: number): GameStateEntity {
    const players = (state.players ?? []).map((p) => (p.id === playerId ? { ...p, alive: false } : p));
    return { ...state, players };
  }

  livingIds(state: GameStateEntity): number[] {
    return (state.players ?? [])
      .filter((p) => (p as any).alive !== false)
      .map((p) => p.id)
      .filter((id) => typeof id === 'number');
  }

  ensureAliveFlag(players: PlayerStateEntity[]): PlayerStateEntity[] {
    return (players ?? []).map((p) => ({ ...p, alive: (p as any).alive ?? true }));
  }
}
