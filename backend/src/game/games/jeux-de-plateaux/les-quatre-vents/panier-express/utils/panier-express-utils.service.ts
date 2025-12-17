import { Injectable } from '@nestjs/common';
import { GameStateEntity, PlayerStateEntity } from '../../../../../core/entities/game-state.entity';

/**
 * Utilitaires partagés Panier Express.
 * Centralise les helpers liés aux joueurs pour éviter les accès non typés.
 */
@Injectable()
export class PanierExpressUtils {
  playerName(state: GameStateEntity, playerId: number): string {
    const player = state.players?.find((p) => p.id === playerId);
    const username = typeof player?.username === 'string' ? player?.username.trim() : '';
    return username.length ? username : `Joueur ${playerId}`;
  }

  missingShoppingItems(player: PlayerStateEntity | null | undefined): Set<string> {
    if (!player) {
      return new Set();
    }
    const basket = Array.isArray(player.basket) ? player.basket.map((item) => String(item)) : [];
    const shoppingList = this.toStringArray(player.shoppingList);
    return new Set(shoppingList.filter((item) => !basket.includes(item)));
  }

  private toStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .map((entry) => (entry == null ? '' : String(entry)))
        .filter((entry): entry is string => entry.length > 0);
    }
    if (typeof value === 'string') {
      return [value];
    }
    return [];
  }
}
