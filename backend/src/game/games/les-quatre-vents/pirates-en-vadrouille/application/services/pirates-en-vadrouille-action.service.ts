import type {
  GameStateEntity,
  PendingState,
} from '../../../../../core/application/models/game-state.model';
import type { GameSingleActionDto } from '../../../../../core/application/models/game-action.model';
import { resolvePlayerNameFromState } from '../../../../../core/application/helpers/player-name.helper';

import { GameCoreService } from '../../../../../core/application/services/game-core.service';
import { RandomService } from '../../../../../core/application/services/random.service';
import { TurnFlowService } from '../../../../../core/application/services/turn-flow.service';
import { DeckPoliciesService } from '../../../../../deck-policies/application/services/deck-policies.service';
import {
  clearPendingState,
  createPendingState,
  isPendingType,
} from '../../../../../core/application/services/pending-action.service';
import type {
  PiratesEnVadrouilleBonusCard,
  PiratesEnVadrouilleCollection,
  PiratesEnVadrouilleMetadata,
  PiratesEnVadrouilleObstacleCard,
  PiratesEnVadrouilleTreasureCard,
} from '../../model/pirates-en-vadrouille-state.model';
import {
  applyActionsSequentially,
  dispatchByActionType,
  normalizeActionType,
} from '../../../../../core/application/helpers/action-service.helper';

import {
  OBSTACLE_CARD_EFFECTS,
  BONUS_CARD_EFFECTS,
  PiratesCardEffect,
} from '../../actions/pirate-card-effects';
import {
  asPiratesEnVadrouilleRecord,
  describePiratesEnVadrouillePawnLabel,
} from './pirates-en-vadrouille-action.utils';

type DeckName = 'bonus' | 'treasure' | 'obstacle';

export class PiratesEnVadrouilleActionService {
  constructor(
    private readonly random: RandomService,
    private readonly turns: TurnFlowService,
    private readonly core: GameCoreService,
    private readonly deckPolicies: DeckPoliciesService,
  ) {}

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    const next = applyActionsSequentially(state, actions, (next, action) => {
      const type = normalizeActionType(action);
      return dispatchByActionType(
        type,
        {
          roll: () => {
            next = this.handleRoll(next);
            return next;
          },
          choose_target: () => {
            next = this.handleChooseTarget(next, action);
            return next;
          },
        },
        () => next,
      );
    });
    return next;
  }

  private handleRoll(state: GameStateEntity): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    if (state.pending) return state;

    const playerId = state.turn?.currentPlayerId ?? null;
    if (playerId == null) return state;

    const meta = this.getMeta(state);
    const skip = meta.statuses.skipTurn?.[playerId] ?? 0;
    if (skip > 0) {
      const nextStatuses = {
        ...meta.statuses,
        skipTurn: {
          ...(meta.statuses.skipTurn ?? {}),
          [playerId]: Math.max(0, skip - 1),
        },
      };
      return this.turns.advanceTurn(
        this.core.appendLog(
          {
            ...state,
            metadata: {
              ...(state.metadata ?? {}),
              ...meta,
              statuses: nextStatuses,
            },
          },
          `${resolvePlayerNameFromState(state, playerId)} saute son tour (${skip} restant).`,
        ),
      );
    }

    const rng = this.random.rollDice(meta as Record<string, unknown>, 6);
    const nextMeta = { ...meta, ...rng.meta };
    let next: GameStateEntity = {
      ...state,
      lastRoll: rng.roll,
      metadata: { ...(state.metadata ?? {}), ...nextMeta },
    };
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} lance le dé : "${rng.roll}".`,
    );

    next = this.move(next, playerId, rng.roll);
    next = this.applyLanding(next, playerId);

    const updatedMeta = this.getMeta(next);
    if (updatedMeta.winnerId != null) {
      return { ...next, status: 'finished' };
    }
    if (next.pending) return next;

    if (updatedMeta.keepTurn) {
      const metaCopy = { ...updatedMeta };
      delete metaCopy.keepTurn;
      next = {
        ...next,
        metadata: { ...(next.metadata ?? {}), ...metaCopy },
      };
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} rejoue.`,
      );
      return next;
    }

    return this.turns.advanceTurn(next);
  }

  private handleChooseTarget(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    const pending = state.pending;
    if (!pending || !isPendingType(state, 'choose_target')) return state;
    const playerId = state.turn?.currentPlayerId ?? null;
    if (playerId == null) return state;

    const payload = asPiratesEnVadrouilleRecord(action.payload);
    const targetId = Number(payload.targetPlayerId);
    const pendingData = asPiratesEnVadrouilleRecord(pending.data);
    const optionsRaw = Array.isArray(pendingData.options)
      ? pendingData.options
      : [];
    const options: Array<{ targetPlayerId: number }> = optionsRaw
      .map((entry) => {
        const row = asPiratesEnVadrouilleRecord(entry);
        return { targetPlayerId: Number(row.targetPlayerId) };
      })
      .filter((entry) => Number.isFinite(entry.targetPlayerId));
    if (
      !Number.isFinite(targetId) ||
      !options.some((opt) => opt.targetPlayerId === targetId)
    ) {
      return state;
    }

    const meta = this.getMeta(state);
    const ctx = meta.pendingContext;
    if (!ctx || ctx.actorId !== playerId) {
      return clearPendingState(state);
    }

    let next = this.applyTargetEffect(state, targetId, ctx);
    const updatedMeta = this.getMeta(next);
    next = {
      ...clearPendingState(next),
      metadata: {
        ...(next.metadata ?? {}),
        ...updatedMeta,
        pendingContext: null,
      },
    };

    if (next.pending) return next;
    return this.turns.advanceTurn(next);
  }

  private applyLanding(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    let next = state;
    const meta = this.getMeta(next);
    const pos = meta.positions?.[playerId] ?? 0;
    const tile = meta.tiles[pos];
    if (!tile) return next;

    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} place ${describePiratesEnVadrouillePawnLabel(next, playerId)} en case ${tile.n} (${tile.title}).`,
    );

    switch (tile.type) {
      case 'bonus':
        return this.drawCard(next, playerId, 'bonus');
      case 'treasure':
        return this.drawCard(next, playerId, 'treasure');
      case 'obstacle':
        return this.drawCard(next, playerId, 'obstacle');
      case 'gold':
        return this.collectGold(next, playerId);
      case 'finish':
        return this.handleFinish(next, playerId);
      default:
        return next;
    }
  }

  private drawCard(
    state: GameStateEntity,
    playerId: number,
    deckName: DeckName,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const draw = this.drawFromDeck(meta, deckName);
    let next: GameStateEntity = {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...draw.meta },
    };
    const card = draw.card;
    if (!card) {
      return this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} n’a plus de cartes ${deckName}.`,
      );
    }

    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} pioche la carte "${card.title}".`,
    );
    next = this.addCardToCollection(next, playerId, deckName, card);

    if (deckName === 'treasure') {
      return next;
    }
    if (deckName === 'bonus') {
      return this.applyBonusCard(
        next,
        playerId,
        card as PiratesEnVadrouilleBonusCard,
      );
    }
    return this.applyObstacleCard(
      next,
      playerId,
      card as PiratesEnVadrouilleObstacleCard,
    );
  }

  private applyBonusCard(
    state: GameStateEntity,
    playerId: number,
    card: PiratesEnVadrouilleBonusCard,
  ): GameStateEntity {
    let next = state;
    const effect = BONUS_CARD_EFFECTS[card.id];
    if (!effect) return next;

    next = this.core.appendLog(
      next,
      this.formatActionMessage(next, effect, playerId),
    );

    switch (effect.kind) {
      case 'move':
        return this.move(next, playerId, effect.delta);
      case 'immunity':
        return this.addImmunity(next, playerId, effect.turns);
      case 'reroll':
        return this.setKeepTurn(next);
      case 'targetMove':
      case 'stealTreasure':
        return this.promptTargetSelection(next, playerId, effect);
      case 'gainGold':
        return this.modifyGold(next, playerId, effect.amount);
      default:
        return next;
    }
  }

  private applyObstacleCard(
    state: GameStateEntity,
    playerId: number,
    card: PiratesEnVadrouilleObstacleCard,
  ): GameStateEntity {
    let next = state;
    const meta = this.getMeta(next);
    const immunity = meta.statuses.obstacleImmunity?.[playerId] ?? 0;
    if (immunity > 0) {
      const nextStatuses = {
        ...meta.statuses,
        obstacleImmunity: {
          ...(meta.statuses.obstacleImmunity ?? {}),
          [playerId]: Math.max(0, immunity - 1),
        },
      };
      next = {
        ...next,
        metadata: { ...(next.metadata ?? {}), ...meta, statuses: nextStatuses },
      };
      return this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} est protégé et ignore l'obstacle "${card.title}".`,
      );
    }

    const effect = OBSTACLE_CARD_EFFECTS[card.id];
    if (!effect) return next;
    next = this.core.appendLog(
      next,
      this.formatActionMessage(next, effect, playerId),
    );

    switch (effect.kind) {
      case 'move':
        return this.move(next, playerId, effect.delta);
      case 'skip':
        return this.addSkip(next, playerId, effect.turns);
      case 'loseGold':
        return this.modifyGold(next, playerId, -effect.amount);
      default:
        return next;
    }
  }

  private applyTargetEffect(
    state: GameStateEntity,
    targetPlayerId: number,
    ctx: PiratesEnVadrouilleMetadata['pendingContext'],
  ): GameStateEntity {
    if (!ctx) return state;
    let next = state;
    if (ctx.kind === 'target_move' && ctx.actorId != null) {
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, ctx.actorId)} applique ${
          ctx.delta >= 0 ? 'un boost' : 'un ralentissement'
        } à ${resolvePlayerNameFromState(next, targetPlayerId)} (${ctx.delta}).`,
      );
      next = this.move(next, targetPlayerId, ctx.delta);
      return next;
    }
    if (ctx.kind === 'steal_treasure' && ctx.actorId != null) {
      const targetCollection = this.getCollection(next, targetPlayerId);
      const stolen = targetCollection.treasures.slice(-1)[0];
      if (!stolen) {
        return this.core.appendLog(
          next,
          `${resolvePlayerNameFromState(next, ctx.actorId)} tente de voler un trésor mais ${resolvePlayerNameFromState(
            next,
            targetPlayerId,
          )} n'en possède pas.`,
        );
      }
      const trimmed = targetCollection.treasures.slice(0, -1);
      next = this.setCollection(next, targetPlayerId, {
        ...targetCollection,
        treasures: trimmed,
      });
      next = this.addCardToCollection(next, ctx.actorId, 'treasure', stolen);
      return this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, ctx.actorId)} dérobe "${stolen.title}" à ${resolvePlayerNameFromState(
          next,
          targetPlayerId,
        )}.`,
      );
    }
    return next;
  }

  private promptTargetSelection(
    state: GameStateEntity,
    playerId: number,
    effect: PiratesCardEffect,
  ): GameStateEntity {
    const players = Array.isArray(state.players) ? state.players : [];
    const targets = players
      .filter((p) => p?.id != null && p.id !== playerId)
      .map((p) => ({ targetPlayerId: p.id }));
    if (!targets.length) return state;

    const pending: PendingState = {
      type: 'choose_target',
      playerId,
      blocking: true,
      label: 'Choisissez un joueur cible.',
      data: { options: targets },
    };
    const meta = this.getMeta(state);
    const pendingContext =
      effect.kind === 'targetMove'
        ? { kind: 'target_move', actorId: playerId, delta: effect.delta }
        : effect.kind === 'stealTreasure'
          ? { kind: 'steal_treasure', actorId: playerId, count: effect.count }
          : null;
    return {
      ...createPendingState(state, pending),
      metadata: {
        ...(state.metadata ?? {}),
        ...meta,
        pendingContext,
      },
    };
  }

  private collectGold(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    return this.modifyGold(state, playerId, 1);
  }

  private handleFinish(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const collection = this.getCollection(state, playerId);
    if (collection.treasures.length >= 3 || collection.goldPieces >= 3) {
      const next = {
        ...state,
        metadata: { ...(state.metadata ?? {}), ...meta, winnerId: playerId },
        status: 'finished',
      };
      return this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} ouvre le coffre légendaire et gagne la partie !`,
      );
    }
    const next = this.core.appendLog(
      state,
      `${resolvePlayerNameFromState(state, playerId)} n'a pas assez de trésors ou pièces d'or et recule de deux cases.`,
    );
    return this.move(next, playerId, -2);
  }

  private addCardToCollection(
    state: GameStateEntity,
    playerId: number,
    deck: DeckName,
    card:
      | PiratesEnVadrouilleBonusCard
      | PiratesEnVadrouilleObstacleCard
      | PiratesEnVadrouilleTreasureCard,
    force = false,
  ): GameStateEntity {
    const collection = this.getCollection(state, playerId);
    const total = this.getTotalCards(collection);
    if (!force && total >= 5) {
      return this.core.appendLog(
        state,
        `${resolvePlayerNameFromState(state, playerId)} a déjà cinq cartes et ne peut pas en ajouter.`,
      );
    }
    const updated = { ...collection };
    if (deck === 'bonus') {
      updated.bonus = [...updated.bonus, card as PiratesEnVadrouilleBonusCard];
    } else if (deck === 'obstacle') {
      updated.obstacles = [
        ...updated.obstacles,
        card as PiratesEnVadrouilleObstacleCard,
      ];
    } else if (deck === 'treasure') {
      updated.treasures = [
        ...updated.treasures,
        card as PiratesEnVadrouilleTreasureCard,
      ];
    }
    return this.setCollection(state, playerId, updated);
  }

  private setCollection(
    state: GameStateEntity,
    playerId: number,
    collection: PiratesEnVadrouilleCollection,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const collections = { ...(meta.collections ?? {}), [playerId]: collection };
    return {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...meta, collections },
    };
  }

  private addSkip(
    state: GameStateEntity,
    playerId: number,
    turns: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const current = meta.statuses.skipTurn?.[playerId] ?? 0;
    const statuses = {
      ...meta.statuses,
      skipTurn: {
        ...(meta.statuses.skipTurn ?? {}),
        [playerId]: current + turns,
      },
    };
    return {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...meta, statuses },
    };
  }

  private addImmunity(
    state: GameStateEntity,
    playerId: number,
    turns: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const current = meta.statuses.obstacleImmunity?.[playerId] ?? 0;
    const statuses = {
      ...meta.statuses,
      obstacleImmunity: {
        ...(meta.statuses.obstacleImmunity ?? {}),
        [playerId]: current + turns,
      },
    };
    return {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...meta, statuses },
    };
  }

  private modifyGold(
    state: GameStateEntity,
    playerId: number,
    amount: number,
  ): GameStateEntity {
    const collection = this.getCollection(state, playerId);
    const updated = {
      ...collection,
      goldPieces: Math.max(0, collection.goldPieces + amount),
    };
    return this.setCollection(state, playerId, updated);
  }

  private setKeepTurn(state: GameStateEntity): GameStateEntity {
    const meta = this.getMeta(state);
    const copy: PiratesEnVadrouilleMetadata = { ...meta, keepTurn: true };
    return { ...state, metadata: { ...(state.metadata ?? {}), ...copy } };
  }

  private drawFromDeck(
    meta: PiratesEnVadrouilleMetadata,
    deck: DeckName,
  ): {
    card:
      | PiratesEnVadrouilleBonusCard
      | PiratesEnVadrouilleTreasureCard
      | PiratesEnVadrouilleObstacleCard
      | null;
    meta: PiratesEnVadrouilleMetadata;
  } {
    type DeckCard =
      | PiratesEnVadrouilleBonusCard
      | PiratesEnVadrouilleTreasureCard
      | PiratesEnVadrouilleObstacleCard;
    const draw = this.deckPolicies.drawFromPile<
      DeckCard,
      PiratesEnVadrouilleMetadata
    >({
      meta,
      pile: Array.isArray(meta.decks?.[deck]) ? meta.decks[deck] : [],
      discard: Array.isArray(meta.discards?.[deck]) ? meta.discards[deck] : [],
      useWholeMetaRng: true,
      discardDrawnCard: true,
    });
    const nextMeta: PiratesEnVadrouilleMetadata = {
      ...draw.meta,
      decks: { ...draw.meta.decks, [deck]: draw.pile },
      discards: { ...draw.meta.discards, [deck]: draw.discard },
    };
    return { card: draw.card ?? null, meta: nextMeta };
  }

  private formatActionMessage(
    state: GameStateEntity,
    effect: PiratesCardEffect,
    playerId: number,
  ): string {
    const description = (() => {
      switch (effect.kind) {
        case 'move':
          return effect.delta >= 0
            ? `avance de ${effect.delta} cases`
            : `recule de ${Math.abs(effect.delta)} cases`;
        case 'skip':
          return `saute ${effect.turns} tour(s)`;
        case 'immunity':
          return `est protégé contre ${effect.turns} obstacle(s)`;
        case 'gainGold':
          return `gagne ${effect.amount} pièce(s) d'or`;
        case 'loseGold':
          return `perd ${effect.amount} pièce(s) d'or`;
        case 'reroll':
          return 'relance immédiatement le dé';
        case 'targetMove':
          return `rétrograde un adversaire de ${Math.abs(effect.delta)} case(s)`;
        case 'stealTreasure':
          return `tente de voler ${effect.count} trésor(s)`;
        default:
          return 'applique un effet';
      }
    })();
    return `${resolvePlayerNameFromState(state, playerId)} ${description}.`;
  }

  private getCollection(
    state: GameStateEntity,
    playerId: number,
  ): PiratesEnVadrouilleCollection {
    const meta = this.getMeta(state);
    const current = meta.collections?.[playerId];
    if (current) return current;
    return {
      treasures: [],
      obstacles: [],
      bonus: [],
      goldPieces: 0,
    };
  }

  private getTotalCards(
    collection: PiratesEnVadrouilleMetadata['collections'][number],
  ): number {
    return (
      (collection.treasures?.length ?? 0) +
      (collection.obstacles?.length ?? 0) +
      (collection.bonus?.length ?? 0)
    );
  }

  private move(
    state: GameStateEntity,
    playerId: number,
    delta: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const current = meta.positions?.[playerId] ?? 0;
    const nextPos = Math.max(
      0,
      Math.min(current + delta, (meta.tiles?.length ?? 1) - 1),
    );
    return this.setPos(state, playerId, nextPos);
  }

  private setPos(
    state: GameStateEntity,
    playerId: number,
    pos: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const nextMeta: PiratesEnVadrouilleMetadata = {
      ...meta,
      positions: { ...(meta.positions ?? {}), [playerId]: pos },
    };
    return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
  }

  private getMeta(state: GameStateEntity): PiratesEnVadrouilleMetadata {
    return (state.metadata ?? {}) as PiratesEnVadrouilleMetadata;
  }
}
