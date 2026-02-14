import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import { GameCoreService } from '../../../core/services/game-core.service';
@Injectable()
export class TurnPoliciesService {
  constructor(private readonly core: GameCoreService) {}

  playerName(state: GameStateEntity, playerId: number): string {
    const players = Array.isArray(state.players) ? state.players : [];
    const player = players.find((p) => p?.id === playerId);
    const username =
      player?.username && String(player.username).trim()
        ? String(player.username).trim()
        : null;
    return username ?? `Joueur ${playerId}`;
  }

  appendTurnAnnouncement(
    state: GameStateEntity,
    playerId: number | null | undefined,
    playerNameResolver?: (state: GameStateEntity, playerId: number) => string,
  ): GameStateEntity {
    if (typeof playerId !== 'number' || !Number.isFinite(playerId)) return state;
    const label =
      typeof playerNameResolver === 'function'
        ? playerNameResolver(state, playerId)
        : this.playerName(state, playerId);
    return this.core.appendLog(state, `C'est au tour de ${label}.`);
  }

}
