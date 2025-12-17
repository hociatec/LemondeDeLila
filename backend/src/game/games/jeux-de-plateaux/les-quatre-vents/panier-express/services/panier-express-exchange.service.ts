import { Injectable } from '@nestjs/common';
import { GameCoreService } from '../../../../../core/services/game-core.service';
import { GameStateEntity, PendingState } from '../../../../../core/entities/game-state.entity';
import { GameSingleActionDto } from '../../../../../engine/dto/game-action.dto';
import { GenericExchangeService } from '../../../../../modules/exchange/services/generic-exchange.service';
import { DeckPoolService } from '../../../../../modules/cards/services/deck-pool.service';
import { PanierExpressMetadata } from '../entities/panier-express-state.entity';
import { playingLog } from '../../../../../../common/utils/playing-logger';
import { PanierExpressUtils } from './panier-express.utils';

type ExchangeEvent =
  | { type: 'request'; playerId: number }
  | { type: 'resolve'; playerId: number; targetPlayerId: number; give: string; take: string };

type ExchangeState = 'idle' | 'pending' | 'resolved';

type ExchangeResult = {
  state: GameStateEntity;
  status: ExchangeState;
};

@Injectable()
export class PanierExpressExchangeService {
  constructor(
    private readonly exchangeHelper: GenericExchangeService,
    private readonly deckPool: DeckPoolService,
    private readonly core: GameCoreService,
    private readonly utils: PanierExpressUtils,
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
    return this.transitionExchange(state, { type: 'request', playerId }).state;
  }

  resolveExchange(state: GameStateEntity, playerId: number, targetPlayerId: number, give: string, take: string): GameStateEntity {
    return this.transitionExchange(state, { type: 'resolve', playerId, targetPlayerId, give, take }).state;
  }

  private transitionExchange(state: GameStateEntity, event: ExchangeEvent): ExchangeResult {
    if (event.type === 'request') {
      return this.requestExchange(state, event.playerId);
    }
    return this.resolveExchangeInternal(state, event);
  }

  private requestExchange(state: GameStateEntity, playerId: number): ExchangeResult {
    const meta = state.metadata as PanierExpressMetadata;
    if (!meta.decks) {
      return { state: this.core.appendLog(state, '[Panier Express] Decks indisponibles pour les échanges.'), status: 'idle' };
    }
    const { card, pool } = this.deckPool.draw<string>(meta.decks as any, 'exchanges');
    const metadata = { ...meta, decks: pool as any } as PanierExpressMetadata;
    const resolvedCard = card ?? 'exchange';

    if (!this.hasInventory(state, playerId)) {
      const moved = this.movePlayer(state, playerId, -5, metadata);
      return {
        state: this.core.appendLog(
          moved,
          `[Panier Express] Pas d'échange possible (${resolvedCard}) : ${this.utils.playerName(state, playerId)} recule de 5 cases.`,
        ),
        status: 'idle',
      };
    }

    const offers = this.exchangeHelper.buildActions<string>({ players: state.players ?? [] }, playerId, 'inventory');
    if (!offers.length) {
      const moved = this.movePlayer(state, playerId, -5, metadata);
      return {
        state: this.core.appendLog(
          moved,
          `[Panier Express] Pas d'échange compatible (${resolvedCard}) : ${this.utils.playerName(state, playerId)} recule de 5 cases.`,
        ),
        status: 'idle',
      };
    }

    playingLog('panier.exchange.pending', { playerId, card: resolvedCard, offers: offers.length });
    const pending: PendingState = { type: 'exchange', playerId, card: resolvedCard };
    return { state: { ...state, metadata, pending }, status: 'pending' };
  }

  private resolveExchangeInternal(
    state: GameStateEntity,
    event: Extract<ExchangeEvent, { type: 'resolve' }>,
  ): ExchangeResult {
    const players = state.players ?? [];
    const current = players.find((p) => p.id === event.playerId);
    const target = players.find((p) => p.id === event.targetPlayerId);
    if (!current || !target) {
      return { state: this.core.appendLog(state, `[Panier Express] Échange invalide: joueur introuvable.`), status: 'idle' };
    }
    if (!this.hasCardsForExchange(current, target, event.give, event.take)) {
      return { state: this.core.appendLog(state, `[Panier Express] Échange refusé: carte absente.`), status: 'idle' };
    }

    const updatedPlayers = players.map((p) => {
      if (p.id === current.id) {
        return this.transferInventory(p, event.give, event.take);
      }
      if (p.id === target.id) {
        return this.transferInventory(p, event.take, event.give);
      }
      return p;
    });

    const next: GameStateEntity = { ...state, players: updatedPlayers, pending: null };
    const logged = this.core.appendLog(
      next,
      `[Panier Express] Échange validé: ${current.username} donne ${event.give} et reçoit ${event.take} de ${target.username}`,
    );
    return { state: logged, status: 'resolved' };
  }

  private hasInventory(state: GameStateEntity, playerId: number): boolean {
    const player = (state.players ?? []).find((p) => p.id === playerId);
    return Array.isArray((player as any)?.inventory) && (player as any).inventory.length > 0;
  }

  private hasCardsForExchange(current: any, target: any, give: string, take: string): boolean {
    const currentInv = new Set(current.inventory ?? []);
    const targetInv = new Set(target.inventory ?? []);
    return currentInv.has(give) && targetInv.has(take);
  }

  private transferInventory(player: any, removeCard: string, addCard: string): any {
    const list = Array.isArray(player.shoppingList) ? player.shoppingList : [];
    const basket = Array.isArray(player.basket) ? [...player.basket] : [];
    const inventory = Array.isArray(player.inventory) ? [...player.inventory] : [];
    const cleanedInventory = this.removeOne(inventory, removeCard);
    if (list.includes(addCard) && !basket.includes(addCard)) {
      return { ...player, basket: [addCard, ...basket], inventory: cleanedInventory };
    }
    return { ...player, inventory: [addCard, ...cleanedInventory] };
  }

  private removeOne(collection: any[], value: string): any[] {
    const copy = Array.isArray(collection) ? [...collection] : [];
    const idx = copy.findIndex((entry) => entry === value);
    if (idx >= 0) {
      copy.splice(idx, 1);
    }
    return copy;
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

}
