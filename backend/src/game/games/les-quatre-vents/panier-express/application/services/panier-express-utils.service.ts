import {
  GameStateEntity,
  PlayerStateEntity,
} from '../../../../../application/models/game-state.model';
import { PanierExpressPlayer } from './panier-express-state.model';

/**
 * Utilitaires partagÃ©s Panier Express.
 * Centralise les helpers liÃ©s aux joueurs pour Ã©viter les accÃ¨s non typÃ©s.
 */
export class PanierExpressUtils {
  private static readonly COURSE_LABELS: Record<string, string> = {
    cepe: 'cÃ¨pe',
    'celeri-branche': 'cÃ©leri-branche',
    chataigne: 'chÃ¢taigne',
    clementine: 'clÃ©mentine',
    echalote: 'Ã©chalote',
    epinard: 'Ã©pinard',
    feve: 'fÃ¨ve',
    'jeune-pousse-d-ortie': "jeune pousse d'ortie",
    mais: 'maÃ¯s',
    mure: 'mÃ»re',
    nefle: 'nÃ¨fle',
    patisson: 'pÃ¢tisson',
    peche: 'pÃªche',
    'pois-casse': 'pois cassÃ©s',
  };

  private static readonly EVENT_LABELS: Record<string, string> = {
    'produit-avarie': 'Produit avariÃ©',
    'producteur-genereux': 'Producteur gÃ©nÃ©reux',
    'troc-improvise': 'Troc improvisÃ©',
  };

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

  normalizePlayer(
    player: Partial<PanierExpressPlayer> | PlayerStateEntity,
  ): PanierExpressPlayer {
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

  normalizePlayers(
    players: Array<Partial<PanierExpressPlayer> | PlayerStateEntity> | undefined,
  ): PanierExpressPlayer[] {
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

  isBot(
    player: Partial<PanierExpressPlayer> | PlayerStateEntity | null | undefined,
  ): boolean {
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
        const normalized = this.normalizePlayer(p);
        const hasList = normalized.shoppingList.length > 0;
        const hasBasket = normalized.basket.length > 0;
        const hasInventory = normalized.inventory.length > 0;
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

  formatCourseLabel(courseId: unknown): string {
    const raw = typeof courseId === 'string' ? courseId.trim() : '';
    if (!raw) return '';
    return PanierExpressUtils.COURSE_LABELS[raw] ?? raw;
  }

  formatCourseLabels(list: Iterable<unknown> | null | undefined): string[] {
    if (!list) return [];
    return Array.from(list)
      .map((v) => this.formatCourseLabel(v))
      .filter((s) => s.length > 0);
  }

  formatEventLabel(eventId: unknown): string {
    const raw = typeof eventId === 'string' ? eventId.trim() : '';
    if (!raw) return '';
    const direct = PanierExpressUtils.EVENT_LABELS[raw];
    if (direct) return direct;

    const tokenMap: Record<string, string> = {
      echange: 'Ã©change',
      journee: 'journÃ©e',
      marche: 'marchÃ©',
      intemperie: 'intempÃ©rie',
      avarie: 'avariÃ©',
      controle: 'contrÃ´le',
      ephemere: 'Ã©phÃ©mÃ¨re',
      fidelite: 'fidÃ©litÃ©',
      abime: 'abÃ®mÃ©',
      detrempe: 'dÃ©trempÃ©',
      derriere: 'derriÃ¨re',
      arriere: 'arriÃ¨re',
      impose: 'imposÃ©',
      perce: 'percÃ©',
      spontane: 'spontanÃ©',
      genereux: 'gÃ©nÃ©reux',
      improvise: 'improvisÃ©',
    };
    const extraTokenMap: Record<string, string> = {
      recompensee: 'r\u00e9compens\u00e9e',
      inversee: 'invers\u00e9e',
      fete: 'f\u00eate',
      ferme: 'ferm\u00e9',
      bonde: 'bond\u00e9',
      defectueux: 'd\u00e9fectueux',
      oublie: 'oubli\u00e9',
      anime: 'animÃ©',
      spontanee: 'spontanÃ©e',
    };
    const words = raw
      .split('-')
      .map((token) => tokenMap[token] ?? extraTokenMap[token] ?? token)
      .filter((t) => t.length > 0);
    if (!words.length) return raw;
    const label = words.join(' ');
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  getTileLabel(
    tile: { id?: string; type?: string; standId?: string } | null | undefined,
  ): string {
    if (!tile) return 'inconnu';

    switch (tile.type) {
      case 'start':
        return 'dÃ©part';
      case 'rest':
        return 'repos';
      case 'stand':
        return `stand ${tile.standId ?? 'inconnu'}`;
      case 'event':
        return 'Ã©vÃ©nement';
      case 'exchange':
        return 'Ã©change';
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







