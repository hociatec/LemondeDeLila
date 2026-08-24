import { GameCoreService } from '../../../../../application/services/game-core.service';
import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import { playingLog } from '../../../../../../common/utils/public-api';
import type { PanierExpressMetadata } from '../../model/panier-express-state.model';
import { PanierExpressUtils } from './panier-express-utils.service';
import { PanierExpressDeckService } from './panier-express-deck.service';
import type { InteractiveExchangeAdapter } from '../../../../../application/features/exchange/models/interactive-exchange.model';
import { defaultExchangeTargets } from '../../../../../application/features/exchange/models/interactive-exchange.model';
import { InteractiveExchangeService } from '../../../../../application/features/exchange/services/interactive-exchange.service';
import { PanierExpressSetupService } from './panier-express-setup.service';
import { RandomService } from '../../../../../application/services/random.service';
import { applyPanierExpressExchangeCard } from '../../actions/panier-express-exchange-card.helpers';
import { requestPanierExpressSpecialExchange } from '../../actions/panier-express-exchange-request.helpers';
import type { PanierExpressPlayer } from '../../model/panier-express-state.model';
import {
  addCardToPlayerState,
  removeOne,
  setSkipTurns,
} from '../../actions/panier-express-exchange-state.helpers';

type ExchangeBonusPendingState = {
  type: 'draw';
  playerId: number;
  blocking: true;
  label: string;
  data: {
    kind: 'queue';
    queue: Array<{ playerId: number; standId?: string }>;
    cursor: number;
  };
};

type ExchangeConfirmPendingState = {
  type?: string;
  step?: string;
  initiatorUsername?: string;
  targetUsername?: string;
};

export class PanierExpressExchangeService {
  constructor(
    private readonly core: GameCoreService,
    private readonly utils: PanierExpressUtils,
    private readonly deckHelper: PanierExpressDeckService,
    private readonly exchangeFlow: InteractiveExchangeService,
    private readonly setup: PanierExpressSetupService,
    private readonly random: RandomService,
  ) {}

  applyExchange(state: GameStateEntity, playerId: number): GameStateEntity {
    if (state.pending) {
      return this.core.appendLog(
        state,
        `[Panier Express] Un autre evenement est deja en attente.`,
      );
    }
    return this.requestExchange(state, playerId);
  }

  chooseTarget(
    state: GameStateEntity,
    playerId: number,
    targetPlayerId: number,
  ): GameStateEntity {
    const result = this.exchangeFlow.chooseTarget(
      state,
      playerId,
      targetPlayerId,
      this.adapter(),
    );
    if (result.kind === 'updated') return result.state;
    return this.core.appendLog(
      state,
      "[Panier Express] Cible d'échange invalide.",
    );
  }

  chooseGive(
    state: GameStateEntity,
    playerId: number,
    give: string,
  ): GameStateEntity {
    const result = this.exchangeFlow.chooseGive(
      state,
      playerId,
      give,
      this.adapter(),
    );
    if (result.kind !== 'offered') {
      return this.core.appendLog(state, `[Panier Express] Échange invalide.`);
    }

    const offer = result.offer;
    const giveLabel = this.utils.formatCourseLabel(offer.give);
    const takeLabel =
      offer.take != null ? this.utils.formatCourseLabel(offer.take) : null;
    const takeText = takeLabel != null ? `"${takeLabel}"` : 'aucune carte';
    return this.core.appendLog(
      result.state,
      `[Panier Express] ${offer.initiatorUsername} propose un échange à ${offer.targetUsername} : il donne "${giveLabel}" et recevra ${takeText}.`,
    );
  }

  acceptOffer(state: GameStateEntity, targetPlayerId: number): GameStateEntity {
    const result = this.exchangeFlow.acceptOffer(
      state,
      targetPlayerId,
      this.adapter(),
    );
    if (result.kind !== 'resolved') {
      return this.core.appendLog(
        state,
        `[Panier Express] Acceptation d'échange invalide.`,
      );
    }

    const offer = result.offer;
    const giveLabel = this.utils.formatCourseLabel(offer.give);
    const takeLabel =
      offer.take != null ? this.utils.formatCourseLabel(offer.take) : null;
    if (offer.bonusRequested) {
      const after = this.core.appendLog(
        result.state,
        `[Panier Express] Échange accepté : ${offer.initiatorUsername} donne "${giveLabel}" à ${offer.targetUsername}. ${offer.targetUsername} n'a aucune carte et perd 2 tours.`,
      );
      return {
        ...after,
        pending: {
          type: 'draw',
          playerId: offer.initiatorPlayerId,
          blocking: true,
          label: 'Piocher une course bonus (Espace).',
          data: {
            kind: 'queue',
            queue: [{ playerId: offer.initiatorPlayerId, standId: 'bonus' }],
            cursor: 0,
          },
        } satisfies ExchangeBonusPendingState,
      };
    }

    playingLog('panier.exchange.resolve', {
      roomId: this.getContextValue(state, 'roomId'),
      gameType: this.getContextValue(state, 'gameType'),
      userId: offer.initiatorPlayerId,
      type: 'exchange_resolve',
      playerId: offer.initiatorPlayerId,
      targetPlayerId: offer.targetPlayerId,
    });

    return this.core.appendLog(
      result.state,
      `[Panier Express] Échange accepté : ${offer.initiatorUsername} donne "${giveLabel}" et reçoit "${takeLabel ?? ''}" de ${offer.targetUsername}.`,
    );
  }

  refuseOffer(state: GameStateEntity, targetPlayerId: number): GameStateEntity {
    const pending = state.pending as ExchangeConfirmPendingState | null;
    const offer =
      pending && pending.type === 'exchange' && pending.step === 'confirm'
        ? pending
        : null;
    const cleared = this.exchangeFlow.refuseOffer(state, targetPlayerId);
    if (!offer) {
      return this.core.appendLog(
        state,
        `[Panier Express] Refus d'échange invalide.`,
      );
    }
    return this.core.appendLog(
      cleared,
      `[Panier Express] ${offer.targetUsername} refuse l'échange proposé par ${offer.initiatorUsername}.`,
    );
  }

  applyExchangeCard(
    state: GameStateEntity,
    initiatorPlayerId: number,
    targetPlayerId: number,
    card: string,
  ): GameStateEntity {
    const resolved = applyPanierExpressExchangeCard({
      state,
      initiatorPlayerId,
      targetPlayerId,
      card,
      utils: this.utils,
      appendLog: (value, message) => this.core.appendLog(value, message),
      createMetaRng: (metadata) => this.random.createMetaRng(metadata),
      pickOne: (metadata, items) => this.random.pickOne(metadata, items),
    });
    if (resolved) {
      return resolved;
    }
    return this.core.appendLog(
      state,
      `[Panier Express] Carte d'échange non gérée : ${String(card ?? '').trim()}.`,
    );
  }

  private requestExchange(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const meta = state.metadata as PanierExpressMetadata;
    if (!meta.decks) {
      return this.core.appendLog(
        state,
        `[Panier Express] Decks indisponibles pour les échanges.`,
      );
    }

    const draw = this.deckHelper.drawWithReplenish<string>(
      meta,
      'exchanges',
      () => this.setup.exchangeCards(),
    );
    const metadata = draw.metadata;
    const resolvedCard = draw.card ?? 'exchange';

    const specialExchange = requestPanierExpressSpecialExchange({
      state,
      metadata,
      playerId,
      resolvedCard,
      utils: this.utils,
      appendLog: (value, message) => this.core.appendLog(value, message),
      nextInt: (currentMetadata, maxExclusive) =>
        this.random.nextInt(currentMetadata, maxExclusive),
      createMetaRng: (currentMetadata) =>
        this.random.createMetaRng(currentMetadata),
      pickOne: (currentMetadata, items) =>
        this.random.pickOne(currentMetadata, items),
      shuffle: (currentMetadata, items) =>
        this.random.shuffle(currentMetadata, items),
    });
    if (specialExchange) {
      return specialExchange;
    }

    const started = this.exchangeFlow.start(
      { ...state, metadata },
      playerId,
      resolvedCard,
      this.adapter(),
    );

    if (started.kind === 'started') {
      const pending = started.pending as { targets?: unknown[] } | null;
      const targetsCount = Array.isArray(pending?.targets)
        ? pending.targets.length
        : 0;
      playingLog('panier.exchange.pending', {
        roomId: this.getContextValue(state, 'roomId'),
        gameType: this.getContextValue(state, 'gameType'),
        userId: playerId,
        type: 'exchange_pending',
        playerId,
        card: resolvedCard,
        targets: targetsCount,
      });
      return started.state;
    }

    const reason =
      started.kind === 'no_targets'
        ? `[Panier Express] Aucun joueur disponible pour un échange (${resolvedCard}).`
        : `[Panier Express] Pas d'échange possible (${resolvedCard}).`;
    return this.core.appendLog({ ...state, metadata }, reason);
  }

  private adapter(): InteractiveExchangeAdapter {
    return {
      listTargets: defaultExchangeTargets,
      getInventory: (state, playerId) => {
        const player = (state.players ?? []).find(
          (entry) => entry.id === playerId,
        ) as PanierExpressPlayer | undefined;
        return this.utils.toStringArray(player?.inventory);
      },
      removeFromInventory: (state, playerId, card) => {
        const players = ((state.players ?? []) as PanierExpressPlayer[]).map((player) => {
          if (player.id !== playerId) return player;
          const inventory = this.utils.toStringArray(player.inventory);
          return { ...player, inventory: removeOne(inventory, card) };
        });
        return { ...state, players };
      },
      addCardToPlayer: (state, playerId, card) =>
        addCardToPlayerState(this.utils, state, playerId, card),
      setSkipTurns: (state, playerId, turns) =>
        setSkipTurns(state, playerId, turns),
    };
  }

  private getContextValue(
    state: GameStateEntity,
    key: 'roomId' | 'gameType',
  ): unknown {
    const meta = state.metadata;
    if (meta == null || typeof meta !== 'object') return null;
    return (meta as Record<string, unknown>)[key] ?? null;
  }
}









