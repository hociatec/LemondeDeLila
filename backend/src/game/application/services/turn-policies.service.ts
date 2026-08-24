import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../models/game-state.model';
import { GameCoreService } from './game-core.service';
import {
  hasRecentPawnSelectionLogs,
  starterTurnAnnouncement,
  turnAnnouncement,
} from '../helpers/game-log-text.helper';
import { stringOrEmpty } from '@common/utils/string-value.utils';

@Injectable()
export class TurnPoliciesService {
  constructor(private readonly core: GameCoreService) {}

  private sanitizePlayerName(raw: unknown): string {
    let name = stringOrEmpty(raw).trim();
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
      const id = Number(p?.id);
      return Number.isFinite(id) ? id === playerId : p?.id === playerId;
    });
    const username = this.sanitizePlayerName(player?.username);
    return username.length > 0 ? username : `Joueur ${playerId}`;
  }

  appendTurnAnnouncement(
    state: GameStateEntity,
    playerId: number | null | undefined,
    playerNameResolver?: (state: GameStateEntity, playerId: number) => string,
  ): GameStateEntity {
    if (typeof playerId !== 'number' || !Number.isFinite(playerId)) {
      return state;
    }
    const label =
      typeof playerNameResolver === 'function'
        ? playerNameResolver(state, playerId)
        : this.playerName(state, playerId);

    const pending = state.pending;
    const pendingType = String(pending?.type ?? '')
      .trim()
      .toLowerCase();
    const pendingPlayerId = Number(pending?.playerId);
    if (pendingType === 'choose_pawn' || pendingType === 'pick_pawn') {
      if (pendingPlayerId !== playerId) {
        return state;
      }
      const prompt = `C'est a ${label} de choisir son pion.`;
      const recentMessages = Array.isArray(state.log)
        ? state.log
            .slice(-6)
            .map((entry) => stringOrEmpty(entry?.message).trim())
        : [];
      if (recentMessages.includes(prompt)) {
        return state;
      }
      return this.core.appendLog(state, prompt);
    }

    return this.core.appendLog(
      state,
      hasRecentPawnSelectionLogs(state.log)
        ? starterTurnAnnouncement(label)
        : turnAnnouncement(label),
    );
  }
}
