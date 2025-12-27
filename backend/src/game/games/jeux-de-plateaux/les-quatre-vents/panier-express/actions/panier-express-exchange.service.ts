import { Injectable } from '@nestjs/common';
import { GameCoreService } from '../../../../../core/services/game-core.service';
import type { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import { playingLog } from '../../../../../../common/utils/playing-logger';
import type { PanierExpressMetadata } from '../model/panier-express-state.entity';
import { PanierExpressUtils } from '../model/panier-express-utils.service';
import { PanierExpressDeckService } from './panier-express-deck.service';
import { PanierExpressDrawService } from './panier-express-draw.service';
import type { InteractiveExchangeAdapter } from '../../../../../modules/exchange/model/interactive-exchange.model';
import { defaultExchangeTargets } from '../../../../../modules/exchange/model/interactive-exchange.model';
import { InteractiveExchangeService } from '../../../../../modules/exchange/services/interactive-exchange.service';

@Injectable()
export class PanierExpressExchangeService {
  constructor(
    private readonly core: GameCoreService,
    private readonly utils: PanierExpressUtils,
    private readonly deckHelper: PanierExpressDeckService,
    private readonly drawSvc: PanierExpressDrawService,
    private readonly exchangeFlow: InteractiveExchangeService,
  ) {}

  applyExchange(state: GameStateEntity, playerId: number): GameStateEntity {
    if (state.pending) {
      return this.core.appendLog(
        state,
        `[Panier Express] Un autre événement est déjà en attente.`,
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
      return this.core.appendLog(state, '[Panier Express] Échange invalide.');
    }

    const offer = result.offer;
    const takeText = offer.take ? `"${offer.take}"` : 'aucune carte';
    return this.core.appendLog(
      result.state,
      `[Panier Express] ${offer.initiatorUsername} propose un échange à ${offer.targetUsername} : il donne "${offer.give}" et recevra ${takeText}.`,
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
        "[Panier Express] Acceptation d'échange invalide.",
      );
    }

    const offer = result.offer;
    if (offer.bonusRequested) {
      const after = this.core.appendLog(
        result.state,
        `[Panier Express] Échange accepté : ${offer.initiatorUsername} donne "${offer.give}" à ${offer.targetUsername}. ${offer.targetUsername} n'a aucune carte et perd 2 tours.`,
      );
      return this.drawSvc.drawCourse(after, offer.initiatorPlayerId, 'bonus');
    }

    playingLog('panier.exchange.resolve', {
      roomId: (state.metadata as any)?.roomId ?? null,
      gameType: (state.metadata as any)?.gameType ?? null,
      userId: offer.initiatorPlayerId,
      type: 'exchange_resolve',
      playerId: offer.initiatorPlayerId,
      targetPlayerId: offer.targetPlayerId,
    });

    return this.core.appendLog(
      result.state,
      `[Panier Express] Échange accepté : ${offer.initiatorUsername} donne "${offer.give}" et reçoit "${offer.take}" de ${offer.targetUsername}.`,
    );
  }

  refuseOffer(state: GameStateEntity, targetPlayerId: number): GameStateEntity {
    const pending = state.pending as any;
    const offer =
      pending && pending.type === 'exchange' && pending.step === 'confirm'
        ? pending
        : null;
    const cleared = this.exchangeFlow.refuseOffer(state, targetPlayerId);
    if (!offer) {
      return this.core.appendLog(
        state,
        "[Panier Express] Refus d'échange invalide.",
      );
    }
    return this.core.appendLog(
      cleared,
      `[Panier Express] ${offer.targetUsername} refuse l'échange proposé par ${offer.initiatorUsername}.`,
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
        '[Panier Express] Decks indisponibles pour les échanges.',
      );
    }

    const draw = this.deckHelper.drawWithReplenish<string>(
      meta,
      'exchanges',
      () => this.defaultExchangeDeck(),
    );
    const metadata = draw.metadata;
    const resolvedCard = draw.card ?? 'exchange';

    const started = this.exchangeFlow.start(
      { ...state, metadata },
      playerId,
      resolvedCard,
      this.adapter(),
    );

    if (started.kind === 'started') {
      const pending = started.pending as any;
      const targetsCount = Array.isArray(pending?.targets)
        ? pending.targets.length
        : 0;
      playingLog('panier.exchange.pending', {
        roomId: (state.metadata as any)?.roomId ?? null,
        gameType: (state.metadata as any)?.gameType ?? null,
        userId: playerId,
        type: 'exchange_pending',
        playerId,
        card: resolvedCard,
        targets: targetsCount,
      });
      return started.state;
    }

    const moved = this.movePlayer(state, playerId, -5, metadata);
    const reason =
      started.kind === 'no_targets'
        ? `[Panier Express] Aucun joueur disponible pour un échange (${resolvedCard}).`
        : `[Panier Express] Pas d'échange possible (${resolvedCard}) : ${this.utils.playerName(state, playerId)} recule de 5 cases.`;
    return this.core.appendLog(moved, reason);
  }

  private adapter(): InteractiveExchangeAdapter {
    return {
      listTargets: defaultExchangeTargets,
      getInventory: (state, playerId) => {
        const player = (state.players ?? []).find(
          (p) => p.id === playerId,
        ) as any;
        return this.utils.toStringArray(player?.inventory);
      },
      removeFromInventory: (state, playerId, card) => {
        const players = (state.players ?? []).map((p: any) => {
          if (p.id !== playerId) return p;
          const inv = this.utils.toStringArray(p.inventory);
          return { ...p, inventory: removeOne(inv, card) };
        });
        return { ...state, players };
      },
      addCardToPlayer: (state, playerId, card) => {
        const players = (state.players ?? []).map((p: any) => {
          if (p.id !== playerId) return p;
          return addCardToPlayer(this.utils, p, card);
        });
        return { ...state, players };
      },
      setSkipTurns: (state, playerId, turns) =>
        setSkipTurns(state, playerId, turns),
    };
  }

  private movePlayer(
    state: GameStateEntity,
    playerId: number,
    delta: number,
    metadata: PanierExpressMetadata,
  ): GameStateEntity {
    if (!delta || delta === 0) return { ...state, metadata };
    const positions = { ...(metadata.positions ?? {}) };
    const laps = { ...(metadata.laps ?? {}) };
    const tiles = Array.isArray(metadata.tiles) ? metadata.tiles : [];
    const total = tiles.length || 1;
    const currentPos = positions[playerId] ?? 0;
    const wraps = Math.floor((currentPos + delta) / total);
    const nextPos = (currentPos + delta + total) % total;
    positions[playerId] = nextPos;

    const currentLaps = typeof laps[playerId] === 'number' ? laps[playerId] : 0;
    laps[playerId] = Math.max(-1, currentLaps + wraps);

    return { ...state, metadata: { ...metadata, positions, laps } };
  }

  private defaultExchangeDeck(): string[] {
    return ['echange-fruit-legume', 'donne-une-carte', 'prend-au-hasard'];
  }
}

function removeOne(collection: string[], value: string): string[] {
  const copy = [...collection];
  const idx = copy.findIndex((entry) => entry === value);
  if (idx >= 0) {
    copy.splice(idx, 1);
  }
  return copy;
}

function addCardToPlayer(
  utils: PanierExpressUtils,
  player: any,
  card: string,
): any {
  const list = utils.toStringArray(player.shoppingList);
  const basket = utils.toStringArray(player.basket);
  const inventory = utils.toStringArray(player.inventory);
  if (list.includes(card) && !basket.includes(card)) {
    return { ...player, basket: [card, ...basket], inventory };
  }
  return { ...player, inventory: [card, ...inventory], basket };
}

function setSkipTurns(
  state: GameStateEntity,
  playerId: number,
  turns: number,
): GameStateEntity {
  const meta = (state.metadata ?? {}) as any;
  const current = meta?.statuses?.skipTurn?.[playerId] ?? 0;
  const nextCount = Math.max(current, Math.max(1, turns || 1));
  return {
    ...state,
    metadata: {
      ...meta,
      statuses: {
        ...(meta?.statuses ?? {}),
        skipTurn: {
          ...(meta?.statuses?.skipTurn ?? {}),
          [playerId]: nextCount,
        },
      },
    },
  };
}
