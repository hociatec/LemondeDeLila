import { Injectable } from '@nestjs/common';
import { GameCoreService } from '../../../../../core/services/game-core.service';
import { GameStateEntity, PendingState, PlayerStateEntity } from '../../../../../core/entities/game-state.entity';
import { GameSingleActionDto } from '../../../../../engine/dto/game-action.dto';
import { GenericExchangeService } from '../../../../../modules/exchange/services/generic-exchange.service';
import { PanierExpressMetadata, PanierExpressPendingExchange } from '../entities/panier-express-state.entity';
import { playingLog } from '../../../../../../common/utils/playing-logger';
import { PanierExpressUtils } from './panier-express.utils';
import { PanierExpressDeckService } from './panier-express-deck.service';

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
    private readonly core: GameCoreService,
    private readonly utils: PanierExpressUtils,
    private readonly deckHelper: PanierExpressDeckService,
  ) {}

  buildExchangeActions(state: GameStateEntity, playerId: number): GameSingleActionDto[] {
    const actions = this.exchangeHelper.buildActions<string>({ players: state.players ?? [] }, playerId, 'inventory');
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
    const pending = this.getPendingExchange(state.pending ?? null);
    const status: ExchangeState = pending ? 'pending' : 'idle';

    if (status === 'idle' && event.type === 'request') {
      return this.requestExchange(state, event.playerId);
    }

    if (status === 'pending' && event.type === 'resolve') {
      if (pending.playerId !== event.playerId) {
        return this.rejectExchange(state, `[Panier Express] Échange appartenant à un autre joueur.`, 'pending');
      }
      return this.resolveExchangeInternal(state, event, pending);
    }

    if (status === 'pending' && event.type === 'request') {
      return this.rejectExchange(
        state,
        `[Panier Express] Échange déjà en attente pour ${this.utils.playerName(state, pending.playerId)}.`,
        'pending',
      );
    }

    return this.rejectExchange(state, `[Panier Express] Échange invalide: aucun échange en attente.`, 'idle');
  }

  private requestExchange(state: GameStateEntity, playerId: number): ExchangeResult {
    const meta = state.metadata as PanierExpressMetadata;
    if (!meta.decks) {
      return this.rejectExchange(state, '[Panier Express] Decks indisponibles pour les échanges.');
    }
    const draw = this.deckHelper.drawWithReplenish<string>(meta, 'exchanges', () => this.defaultExchangeDeck());
    const metadata = draw.metadata;
    const resolvedCard = draw.card ?? 'exchange';

    if (!this.hasInventory(state, playerId)) {
      const moved = this.movePlayer(state, playerId, -5, metadata);
      return this.rejectExchange(
        moved,
        `[Panier Express] Pas d'échange possible (${resolvedCard}) : ${this.utils.playerName(state, playerId)} recule de 5 cases.`,
      );
    }

    const offers = this.exchangeHelper.buildActions<string>({ players: state.players ?? [] }, playerId, 'inventory');
    if (!offers.length) {
      const moved = this.movePlayer(state, playerId, -5, metadata);
      return this.rejectExchange(
        moved,
        `[Panier Express] Pas d'échange compatible (${resolvedCard}) : ${this.utils.playerName(state, playerId)} recule de 5 cases.`,
      );
    }

    playingLog('panier.exchange.pending', { playerId, card: resolvedCard, offers: offers.length });
    const pending: PanierExpressPendingExchange = { type: 'exchange', playerId, card: resolvedCard };
    return { state: { ...state, metadata, pending }, status: 'pending' };
  }

  private resolveExchangeInternal(
    state: GameStateEntity,
    event: Extract<ExchangeEvent, { type: 'resolve' }>,
    pending: PanierExpressPendingExchange,
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

    playingLog('panier.exchange.resolve', {
      playerId: event.playerId,
      targetPlayerId: event.targetPlayerId,
      triggerCard: pending.card,
    });

    const next: GameStateEntity = { ...state, players: updatedPlayers, pending: null };
    const logged = this.core.appendLog(
      next,
      `[Panier Express] Échange validé: ${current.username} donne ${event.give} et reçoit ${event.take} de ${target.username}`,
    );
    return { state: logged, status: 'resolved' };
  }

  private getPendingExchange(pending: PendingState | null): PanierExpressPendingExchange | null {
    if (!pending || pending.type !== 'exchange') {
      return null;
    }
    if (typeof pending.playerId !== 'number' || typeof (pending as PanierExpressPendingExchange).card !== 'string') {
      return null;
    }
    return pending as PanierExpressPendingExchange;
  }

  private rejectExchange(state: GameStateEntity, message: string, status: ExchangeState = 'idle'): ExchangeResult {
    return { state: this.core.appendLog(state, message), status };
  }

  private hasInventory(state: GameStateEntity, playerId: number): boolean {
    const player = (state.players ?? []).find((p) => p.id === playerId);
    return Array.isArray(player?.inventory) && player.inventory.length > 0;
  }

  private hasCardsForExchange(current: PlayerStateEntity, target: PlayerStateEntity, give: string, take: string): boolean {
    const currentInv = new Set(
      Array.isArray(current.inventory) ? current.inventory.map((card) => String(card)) : [],
    );
    const targetInv = new Set(Array.isArray(target.inventory) ? target.inventory.map((card) => String(card)) : []);
    return currentInv.has(give) && targetInv.has(take);
  }

  private transferInventory(player: PlayerStateEntity, removeCard: string, addCard: string): PlayerStateEntity {
    const list = Array.isArray(player.shoppingList) ? player.shoppingList.map((card) => String(card)) : [];
    const basket = Array.isArray(player.basket) ? player.basket.map((card) => String(card)) : [];
    const inventory = Array.isArray(player.inventory) ? player.inventory.map((card) => String(card)) : [];
    const cleanedInventory = this.removeOne(inventory, removeCard);
    if (list.includes(addCard) && !basket.includes(addCard)) {
      return { ...player, basket: [addCard, ...basket], inventory: cleanedInventory };
    }
    return { ...player, inventory: [addCard, ...cleanedInventory] };
  }

  private removeOne(collection: string[], value: string): string[] {
    const copy = [...collection];
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
    return { ...state, metadata: { ...metadata, positions } };
  }

  private defaultExchangeDeck(): string[] {
    return ['echange-fruit-legume', 'donne-une-carte', 'prend-au-hasard'];
  }

}
