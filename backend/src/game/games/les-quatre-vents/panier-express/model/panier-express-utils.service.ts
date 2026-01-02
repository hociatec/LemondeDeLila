import { Injectable } from '@nestjs/common';
import {
  GameStateEntity,
  PlayerStateEntity,
} from '../../../../core/entities/game-state.entity';
import { PanierExpressPlayer } from './panier-express-state.entity';

/**
 * Utilitaires partagés Panier Express.
 * Centralise les helpers liés aux joueurs pour éviter les accès non typés.
 */
@Injectable()
export class PanierExpressUtils {
  playerName(state: GameStateEntity, playerId: number): string {
    const player = state.players?.find((p) => p.id === playerId);
    const username =
      typeof player?.username === 'string' ? player.username.trim() : '';
    return username.length ? username : `Joueur ${playerId}`;
  }

  getPlayerName(state: GameStateEntity, playerId: number): string {
    return this.playerName(state, playerId);
  }

  getPlayer(
    state: GameStateEntity,
    playerId: number,
  ): PanierExpressPlayer | null {
    const player = state.players?.find((p) => p.id === playerId);
    if (!player) return null;
    return this.normalizePlayer(player);
  }

  normalizePlayer(player: any): PanierExpressPlayer {
    return {
      id: player.id,
      username:
        typeof player.username === 'string'
          ? player.username
          : `Joueur ${player.id}`,
      isBot: player.isBot === true,
      shoppingList: this.toStringArray(player.shoppingList),
      basket: this.toStringArray(player.basket),
      inventory: this.toStringArray(player.inventory),
      pawn: typeof player.pawn === 'string' ? player.pawn : undefined,
    };
  }

  normalizePlayers(players: any[] | undefined): PanierExpressPlayer[] {
    if (!Array.isArray(players)) return [];
    return players.map((p) => this.normalizePlayer(p));
  }

  toStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .map((entry) => (entry == null ? '' : String(entry)))
        .filter((entry): entry is string => entry.length > 0);
    }

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed
            .map((entry) => (entry == null ? '' : String(entry)))
            .filter((entry): entry is string => entry.length > 0);
        }
      } catch {
        // ignore
      }

      return value
        .split(/[,;]+/)
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
    }

    return [];
  }

  missingShoppingItems(
    player: PlayerStateEntity | null | undefined,
  ): Set<string> {
    if (!player) return new Set();
    const basket = Array.isArray(player.basket)
      ? player.basket.map((item) => String(item))
      : [];
    const shoppingList = this.toStringArray(player.shoppingList);
    return new Set(shoppingList.filter((item) => !basket.includes(item)));
  }

  getMissingItems(player: PanierExpressPlayer): Set<string> {
    return new Set(
      player.shoppingList.filter((item) => !player.basket.includes(item)),
    );
  }

  hasCompletedShopping(player: PanierExpressPlayer): boolean {
    return (
      player.shoppingList.length > 0 &&
      player.shoppingList.every((item) => player.basket.includes(item))
    );
  }

  isBot(player: any): boolean {
    const username = String(player?.username ?? '').toLowerCase();
    return player?.isBot === true || username.includes('bot');
  }

  isGameInProgress(state: GameStateEntity): boolean {
    const status = String(state.status ?? '').toLowerCase();
    const players = state.players ?? [];

    return (
      status === 'finished' ||
      (typeof state.turnIndex === 'number' && state.turnIndex > 0) ||
      players.some((p) => {
        const hasList =
          Array.isArray((p as any).shoppingList) &&
          (p as any).shoppingList.length > 0;
        const hasBasket =
          Array.isArray((p as any).basket) && (p as any).basket.length > 0;
        const hasInventory =
          Array.isArray((p as any).inventory) &&
          (p as any).inventory.length > 0;
        return hasList || hasBasket || hasInventory;
      })
    );
  }

  removeOne<T>(arr: T[], value: T): T[] {
    const copy = Array.isArray(arr) ? [...arr] : [];
    const idx = copy.findIndex((v) => v === value);
    if (idx >= 0) copy.splice(idx, 1);
    return copy;
  }

  getTileLabel(tile: any): string {
    if (!tile) return 'inconnu';

    switch (tile.type) {
      case 'start':
        return 'départ';
      case 'rest':
        return 'repos';
      case 'stand':
        return `stand ${tile.standId ?? 'inconnu'}`;
      case 'event':
        return 'événement';
      case 'exchange':
        return 'échange';
      case 'quiz':
        return 'quiz';
      case 'move':
        return 'avancer ou reculer';
      case 'move_to_stand':
        return "avance jusqu'au prochain stand";
      case 'skip':
        return 'perd un tour';
      case 'bonus_course':
        return 'pioche course bonus';
      default:
        return tile?.id ?? 'inconnu';
    }
  }
}
