import { Injectable } from '@nestjs/common';
import { GameStateEntity } from '../../../core/entities/game-state.entity';

@Injectable()
export class TurnLabelService {
  compute(state: GameStateEntity, gameType: string): string | null {
    const status = (state?.status ?? '').toLowerCase().trim();
    if (!status) return null;
    if (status === 'finished') return 'Partie terminée.';
    if (status !== 'started') {
      const game = gameType ? `La table ${gameType}` : 'La table';
      return `${game} a été créée, ajoutez des bots et démarrez-la !`;
    }

    const currentPlayerId = state.turn?.currentPlayerId ?? null;
    const players = Array.isArray(state.players) ? state.players : [];
    if (currentPlayerId != null) {
      const found = players.find((p) => p?.id === currentPlayerId);
      const name =
        found?.username && String(found.username).trim()
          ? String(found.username).trim()
          : `Joueur ${currentPlayerId}`;
      return `C'est à ${name} de jouer.`;
    }

    // Compat : certains jeux avancent uniquement via turnIndex sans maintenir currentPlayerId.
    const idx = typeof state.turnIndex === 'number' ? state.turnIndex : -1;
    const byIndex = idx >= 0 && idx < players.length ? players[idx] : null;
    const name =
      byIndex?.username && String(byIndex.username).trim()
        ? String(byIndex.username).trim()
        : byIndex?.id != null
          ? `Joueur ${byIndex.id}`
          : null;
    if (name) return `C'est à ${name} de jouer.`;

    return 'Tour en cours.';
  }
}
