import { Injectable } from '@nestjs/common';
import { GameCoreService } from '../../../../../core/services/game-core.service';
import { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import { GameSingleActionDto } from '../../../../../engine/dto/game-action.dto';
import { GenericExchangeService } from '../../../../../modules/exchange/services/generic-exchange.service';
import { DeckPoolService } from '../../../../../modules/cards/services/deck-pool.service';
import { PanierExpressMetadata } from '../entities/panier-express-state.entity';
import { playingLog } from '../../../../../../common/utils/playing-logger';

@Injectable()
export class PanierExpressExchangeService {
  constructor(
    private readonly exchangeHelper: GenericExchangeService,
    private readonly deckPool: DeckPoolService,
    private readonly core: GameCoreService,
  ) {}

  buildExchangeActions(state: GameStateEntity, playerId: number): GameSingleActionDto[] {
    const actions = this.exchangeHelper.buildActions(state as any, playerId, 'inventory');
    if (!actions.length) return [{ type: 'roll' }];
    const offers = actions.flatMap((offer) =>
      (state.players ?? [])
        .filter((p) => p.id !== playerId)
        .map((target) => ({
          type: 'exchange_with',
          payload: { playerId, targetPlayerId: target.id, give: offer.give, take: offer.take },
        })),
    );
    return offers.length ? offers : [{ type: 'roll' }];
  }

  applyExchange(state: GameStateEntity, playerId: number): GameStateEntity {
    const meta = state.metadata as PanierExpressMetadata;
    if (!meta.decks) {
      return this.core.appendLog(state, '[Panier Express] Decks indisponibles pour les échanges.');
    }
    const { card, pool } = this.deckPool.draw<string>(meta.decks as any, 'exchanges');
    const metadata = { ...meta, decks: pool as any } as PanierExpressMetadata;
    const resolvedCard = card ?? 'exchange';

    const players = state.players ?? [];
    const current = players.find((p) => p.id === playerId);
    if (!current || (current.inventory?.length ?? 0) === 0) {
      const moved = this.movePlayer(state, playerId, -5, metadata);
      return this.core.appendLog(
        moved,
        `[Panier Express] Pas d'échange possible (${resolvedCard}) : ${this.playerName(state, playerId)} recule de 5 cases.`,
      );
    }

    const offers = this.exchangeHelper.buildActions<string>({ players }, playerId, 'inventory');
    if (!offers.length) {
      const moved = this.movePlayer(state, playerId, -5, metadata);
      return this.core.appendLog(
        moved,
        `[Panier Express] Pas d'échange compatible (${resolvedCard}) : ${this.playerName(state, playerId)} recule de 5 cases.`,
      );
    }

    playingLog('panier.exchange.pending', { playerId, card: resolvedCard, offers: offers.length });
    const pending = { type: 'exchange', playerId, card: resolvedCard } as any;
    return { ...state, metadata, pending };
  }

  resolveExchange(state: GameStateEntity, playerId: number, targetPlayerId: number, give: string, take: string): GameStateEntity {
    const players = state.players ?? [];
    const current = players.find((p) => p.id === playerId);
    const target = players.find((p) => p.id === targetPlayerId);
    if (!current || !target) {
      return this.core.appendLog(state, `[Panier Express] Échange invalide: joueur introuvable.`);
    }
    const currentInv = new Set(current.inventory ?? []);
    const targetInv = new Set(target.inventory ?? []);
    if (!currentInv.has(give as any) || !targetInv.has(take as any)) {
      return this.core.appendLog(state, `[Panier Express] Échange refusé: carte absente.`);
    }

    const removeOne = (arr: any[], value: any): any[] => {
      const copy = Array.isArray(arr) ? [...arr] : [];
      const idx = copy.findIndex((v) => v === value);
      if (idx >= 0) {
        copy.splice(idx, 1);
      }
      return copy;
    };

        const updatedPlayers = players.map((p) => {
      if (p.id === current.id) {
        const list = Array.isArray((p as any).shoppingList) ? (p as any).shoppingList : [];
        const basket = Array.isArray((p as any).basket) ? [...(p as any).basket] : [];
        const inventory = Array.isArray((p as any).inventory) ? [...(p as any).inventory] : [];
        const cleanedInventory = removeOne(inventory, give);
        if (list.includes(take) && !basket.includes(take)) {
          return { ...p, basket: [take, ...basket], inventory: cleanedInventory };
        }
        return { ...p, inventory: [take, ...cleanedInventory] };
      }
      if (p.id === target.id) {
        const list = Array.isArray((p as any).shoppingList) ? (p as any).shoppingList : [];
        const basket = Array.isArray((p as any).basket) ? [...(p as any).basket] : [];
        const inventory = Array.isArray((p as any).inventory) ? [...(p as any).inventory] : [];
        const cleanedInventory = removeOne(inventory, take);
        if (list.includes(give) && !basket.includes(give)) {
          return { ...p, basket: [give, ...basket], inventory: cleanedInventory };
        }
        return { ...p, inventory: [give, ...cleanedInventory] };
      }
      return p;
    });

    const next: GameStateEntity = { ...state, players: updatedPlayers, pending: null };
    const logged = this.core.appendLog(
      next,
      `[Panier Express] Échange validé: ${current.username} donne ${give} et reçoit ${take} de ${target.username}`,
    );
    return logged;
  }

  private movePlayer(state: GameStateEntity, playerId: number, delta: number, metadata: PanierExpressMetadata): GameStateEntity {
    if (!delta || delta === 0) return { ...state, metadata };
    const positions = { ...(metadata.positions ?? {}) };
    const tiles = Array.isArray(metadata.tiles) ? metadata.tiles : [];
    const total = tiles.length || 1;
    const currentPos = positions[playerId] ?? 0;
    const nextPos = (currentPos + delta + total) % total;
    positions[playerId] = nextPos;
    return { ...state, metadata: { ...metadata, positions } } as GameStateEntity;
  }

  private playerName(state: GameStateEntity, playerId: number): string {
    const player = state.players?.find((p) => p.id === playerId);
    return player?.username ?? `Joueur ${playerId}`;
  }
}

