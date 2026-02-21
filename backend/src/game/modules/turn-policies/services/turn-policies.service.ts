import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import { GameCoreService } from '../../../core/services/game-core.service';
import { turnAnnouncement } from '../../../core/helpers/game-log-text.helper';
@Injectable()
export class TurnPoliciesService {
  constructor(private readonly core: GameCoreService) {}

  private sanitizePlayerName(raw: unknown): string {
    let name = String(raw ?? '').trim();
    name = name
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (name.startsWith('"') && name.endsWith('"')) {
      name = name.slice(1, -1).trim();
    }
    const lowered = name.toLowerCase();
    if (
      lowered.endsWith('(zone de jeu)') ||
      lowered.endsWith('(zone de jeux)') ||
      lowered.endsWith('(game zone)')
    ) {
      const openParen = name.lastIndexOf('(');
      if (openParen > 0) {
        name = name.slice(0, openParen).trimEnd();
      }
    }
    return name;
  }

  playerName(state: GameStateEntity, playerId: number): string {
    const players = Array.isArray(state.players) ? state.players : [];
    const player = players.find((p) => {
      const id = Number((p as any)?.id);
      return Number.isFinite(id)
        ? id === playerId
        : (p as any)?.id === playerId;
    });
    const username = this.sanitizePlayerName(player?.username);
    return username.length > 0 ? username : `Joueur ${playerId}`;
  }

  appendTurnAnnouncement(
    state: GameStateEntity,
    playerId: number | null | undefined,
    playerNameResolver?: (state: GameStateEntity, playerId: number) => string,
  ): GameStateEntity {
    if (typeof playerId !== 'number' || !Number.isFinite(playerId))
      return state;
    const label =
      typeof playerNameResolver === 'function'
        ? playerNameResolver(state, playerId)
        : this.playerName(state, playerId);
    return this.core.appendLog(state, turnAnnouncement(label));
  }
}
