import { Injectable } from '@nestjs/common';
import { GameStateEntity } from '../models/game-state.model';
import { stringOrEmpty } from '@common/utils/public-api';

@Injectable()
export class TurnLabelService {
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

  compute(state: GameStateEntity, gameType: string): string | null {
    const status = (state?.status ?? '').toLowerCase().trim();
    if (!status) return null;

    if (status === 'finished') return 'Partie terminée.';

    if (status !== 'started') {
      const formatted = (gameType ?? '').trim();
      const label = formatted
        ? formatted
            .split(/[-_ ]+/g)
            .filter(Boolean)
            .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
            .join(' ')
        : 'la table';
      return `Bienvenue sur ${label}. B pour ajouter un bot, Maj+B pour retirer un bot, Entrée pour démarrer la partie.`;
    }

    const players = Array.isArray(state.players) ? state.players : [];
    const currentPlayerId = state.turn?.currentPlayerId ?? null;
    const pendingType = String(state.pending?.type ?? '').trim().toLowerCase();

    if (pendingType === 'choose_pawn' || pendingType === 'pick_pawn') {
      const pendingPlayerId = Number(state.pending?.playerId);
      const targetPlayerId =
        Number.isFinite(pendingPlayerId) && pendingPlayerId > 0
          ? pendingPlayerId
          : currentPlayerId;

      if (targetPlayerId != null) {
        const found = players.find((p) => Number(p?.id) === targetPlayerId);
        const username = this.sanitizePlayerName(found?.username);
        const name =
          username.length > 0 ? username : `Joueur ${targetPlayerId}`;
        return `C'est à ${name} de choisir son pion.`;
      }
    }

    if (currentPlayerId != null) {
      const found = players.find((p) => Number(p?.id) === currentPlayerId);
      const username = this.sanitizePlayerName(found?.username);
      const name = username.length > 0 ? username : `Joueur ${currentPlayerId}`;
      return `C'est à ${name} de jouer.`;
    }

    const idx = typeof state.turnIndex === 'number' ? state.turnIndex : -1;
    const byIndex = idx >= 0 && idx < players.length ? players[idx] : null;
    const username = this.sanitizePlayerName(byIndex?.username);
    const name =
      username.length > 0
        ? username
        : byIndex?.id != null
          ? `Joueur ${byIndex.id}`
          : null;
    if (name) return `C'est à ${name} de jouer.`;

    return 'Tour en cours.';
  }
}
