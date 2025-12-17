import { Injectable } from '@nestjs/common';
<<<<<<< HEAD
import { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import { PanierExpressPlayer } from '../entities/panier-express-state.entity';

/**
 * Service utilitaire pour les opérations courantes de Panier Express
 */
@Injectable()
export class PanierExpressUtilsService {
  /**
   * Récupère le nom d'affichage d'un joueur
   */
  getPlayerName(state: GameStateEntity, playerId: number): string {
    const player = state.players?.find((p) => p.id === playerId);
    return player?.username ?? `Joueur ${playerId}`;
  }

  /**
   * Récupère un joueur par son ID avec typage strict
   */
  getPlayer(state: GameStateEntity, playerId: number): PanierExpressPlayer | null {
    const player = state.players?.find((p) => p.id === playerId);
    if (!player) return null;

    return this.normalizePlayer(player);
  }

  /**
   * Normalise un joueur avec les champs attendus
   */
  normalizePlayer(player: any): PanierExpressPlayer {
    const normalized: PanierExpressPlayer = {
      id: player.id,
      username: typeof player.username === 'string' ? player.username : `Joueur ${player.id}`,
      isBot: player.isBot === true,
      shoppingList: this.toStringArray(player.shoppingList),
      basket: this.toStringArray(player.basket),
      inventory: this.toStringArray(player.inventory),
    };
  
    return normalized;
  }
  

  /**
   * Normalise tous les joueurs d'un état
   */
  normalizePlayers(players: any[] | undefined): PanierExpressPlayer[] {
    if (!Array.isArray(players)) return [];
    return players.map((p) => this.normalizePlayer(p));
  }

  /**
   * Convertit une valeur en tableau de chaînes
   * Gère les cas: tableau, JSON string, chaîne séparée par virgules
   */
  toStringArray(value: any): string[] {
    if (Array.isArray(value)) {
      return value.map((v) => (v == null ? '' : String(v))).filter((v) => v.length > 0);
    }

    if (typeof value === 'string') {
      // Tenter de parser comme JSON
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.map((v) => (v == null ? '' : String(v))).filter((v) => v.length > 0);
        }
      } catch {
        // Si ce n'est pas du JSON, traiter comme une liste séparée
      }

      // Séparer par virgules ou points-virgules
      return value
        .split(/[,;]+/)
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
    }

    return [];
  }

  /**
   * Vérifie si un joueur est un bot
   */
  isBot(player: any): boolean {
    const username = (player?.username ?? '').toLowerCase();
    return player?.isBot === true || username.includes('bot');
  }

  /**
   * Vérifie si une partie a déjà démarré
   */
  isGameInProgress(state: GameStateEntity): boolean {
    const status = (state.status || '').toLowerCase();
    const players = state.players ?? [];

    return (
      status === 'finished' ||
      (typeof state.turnIndex === 'number' && state.turnIndex > 0) ||
      players.some((p) => {
        const hasList = Array.isArray((p as any).shoppingList) && (p as any).shoppingList.length > 0;
        const hasBasket = Array.isArray((p as any).basket) && (p as any).basket.length > 0;
        const hasInventory = Array.isArray((p as any).inventory) && (p as any).inventory.length > 0;
        return hasList || hasBasket || hasInventory;
      })
    );
  }

  /**
   * Retire une occurrence d'une valeur d'un tableau
   */
  removeOne<T>(arr: T[], value: T): T[] {
    const copy = Array.isArray(arr) ? [...arr] : [];
    const idx = copy.findIndex((v) => v === value);
    if (idx >= 0) {
      copy.splice(idx, 1);
    }
    return copy;
  }

  /**
   * Obtient le label d'affichage d'une tuile
   */
  getTileLabel(tile: any): string {
    if (!tile) return 'inconnu';

    switch (tile.type) {
      case 'start':
        return 'départ';
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

  /**
   * Calcule les articles manquants dans le panier d'un joueur
   */
  getMissingItems(player: PanierExpressPlayer): Set<string> {
    return new Set(player.shoppingList.filter((item) => !player.basket.includes(item)));
  }

  /**
   * Vérifie si un joueur a complété sa liste de courses
   */
  hasCompletedShopping(player: PanierExpressPlayer): boolean {
    return (
      player.shoppingList.length > 0 &&
      player.shoppingList.every((item) => player.basket.includes(item))
    );
  }
=======
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
>>>>>>> 8179fa9694f1ee4e62f792502688e2386e82ce1e
}
