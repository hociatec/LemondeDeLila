import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';


import { GameCoreService } from '../../../../core/services/game-core.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import {
  OLYMPIA_CARD_BY_ID,
  OlympiaDeckType,
  OlympiaEffect,
} from '../model/olympia-cards';
import { applyActionsSequentially, dispatchByActionType, normalizeActionType } from '../../../../actions/action-service.helper';
import type {
  OlympiaMetadata,
  OlympiaStatus,
} from '../model/olympia-state.entity';

const VICTORY_PRESTIGE = 30;

type OlympiaActionPayload = {
  deck?: OlympiaDeckType | null;
  cardId?: string | null;
  targetPlayerId?: number | null;
};

@Injectable()
export class OlympiaActionService {
  constructor(
    private readonly core: GameCoreService,
    private readonly turns: TurnFlowService,
  ) {}

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    return applyActionsSequentially(state, actions, (next, action) => {
      const type = normalizeActionType(action);
      return dispatchByActionType(
        type,
        {
          draw_card: () => this.handleDrawCard(next, action),
          play_card: () => this.handlePlayCard(next, action),
          pass: () => this.handlePass(next),
        },
        () => next,
      );
    });
  }

  private handlePass(state: GameStateEntity): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;
    let next = this.core.appendLog(
      state,
      `${this.playerName(state, currentId)} passe son tour.`,
    );
    next = this.advanceAndTick(next);
    return next;
  }

  private handleDrawCard(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;
    const payload = (action.payload ?? {}) as OlympiaActionPayload;
    const deck = payload.deck ?? 'heros';
    let next = state;
    const meta = this.getMeta(next);
    const entry = this.drawOneCard(meta, deck);
    if (!entry.cardId) {
      return this.core.appendLog(
        next,
        `${this.playerName(next, currentId)} n'a plus de cartes dans le deck ${deck}.`,
      );
    }
    const updatedMeta = this.addCardToHand(
      { ...entry.meta, rng: entry.meta.rng },
      currentId,
      entry.cardId,
    );
    next = this.setMeta(next, updatedMeta);
    next = this.core.appendLog(
      next,
      `${this.playerName(next, currentId)} pioche ${this.getCardName(entry.cardId)} (${deck}).`,
    );
    const nextMeta = this.getMeta(next);
    next = this.checkVictory(next, currentId);
    return next;
  }

  private handlePlayCard(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    const payload = (action.payload ?? {}) as OlympiaActionPayload;
    const cardId = String(payload.cardId ?? '').trim();
    if (!cardId) return state;

    const definition = OLYMPIA_CARD_BY_ID[cardId];
    if (!definition) return state;

    const meta = this.getMeta(state);
    const hand = Array.isArray(meta.hands?.[currentId]) ? meta.hands[currentId] : [];
    if (!hand.includes(cardId)) return state;

    let nextMeta = this.removeCardFromHand(meta, currentId, cardId);
    nextMeta = this.addCardToDiscard(nextMeta, cardId);
    let next = this.setMeta(state, nextMeta);
    next = this.core.appendLog(
      next,
      `${this.playerName(next, currentId)} joue ${definition.name}.`,
    );

    if (definition.points) {
      next = this.addPrestige(next, currentId, definition.points);
    }

    if (definition.effect) {
      const effects = Array.isArray(definition.effect)
        ? definition.effect
        : [definition.effect];
      for (const effect of effects) {
        next = this.applyEffect(next, currentId, effect, payload.targetPlayerId ?? null);
      }
    }

    if (this.getMeta(next).winnerId != null) {
      return next;
    }

    next = this.advanceAndTick(next);
    return next;
  }

  private applyEffect(
    state: GameStateEntity,
    actorId: number,
    effect: OlympiaEffect,
    targetId: number | null,
  ): GameStateEntity {
    let next = state;
    if (effect.type === 'prestige') {
      const targets = this.resolveTargets(next, actorId, targetId, effect.target);
      for (const tid of targets) {
        next = this.addPrestige(next, tid, effect.value);
      }
    } else if (effect.type === 'steal') {
      next = this.applySteal(next, actorId, effect.value);
    } else if (effect.type === 'draw') {
      const targets = this.resolveTargets(next, actorId, targetId, effect.target);
      for (const tid of targets) {
        next = this.drawForPlayer(next, tid, effect.amount, effect.decks);
      }
    } else if (effect.type === 'status') {
      const targets = this.resolveTargets(next, actorId, targetId, effect.target);
      for (const tid of targets) {
        next = this.addStatus(next, tid, {
          key: effect.key,
          turns: effect.turns,
          value: effect.value,
        });
      }
    } else if (effect.type === 'discard') {
      const targets = this.resolveTargets(next, actorId, targetId, effect.target);
      for (const tid of targets) {
        next = this.discardRandom(next, tid, effect.amount, effect.categories);
      }
    } else if (effect.type === 'exchange') {
      if (targetId != null) {
        next = this.exchangeCard(next, actorId, targetId, effect.categories);
      }
    } else if (effect.type === 'skip') {
      if (targetId != null) {
        next = this.addSkip(next, targetId, effect.turns);
        next = this.core.appendLog(
          next,
          `${this.playerName(next, targetId)} doit passer ${effect.turns} tour(s).`,
        );
      }
    }
    return next;
  }

  private resolveTargets(
    state: GameStateEntity,
    actorId: number,
    explicitTarget: number | null,
    descriptor: 'self' | 'target' | 'all' | 'others',
  ): number[] {
    const players = Array.isArray(state.players) ? state.players : [];
    const ids = players.filter((p) => p?.id != null).map((p) => p!.id);
    if (descriptor === 'self') return [actorId];
    if (descriptor === 'target' && explicitTarget != null) return [explicitTarget];
    if (descriptor === 'all') return ids;
    if (descriptor === 'others') return ids.filter((id) => id !== actorId);
    return [];
  }

  private addPrestige(
    state: GameStateEntity,
    playerId: number,
    amount: number,
  ): GameStateEntity {
    if (amount === 0) return state;
    const meta = this.getMeta(state);
    const prestige = { ...(meta.prestige ?? {}) };
    prestige[playerId] = (prestige[playerId] ?? 0) + amount;
    let next = this.setMeta(state, { ...meta, prestige });
    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} ${amount >= 0 ? 'gagne' : 'perd'} ${Math.abs(
        amount,
      )} point(s) de prestige.`,
    );
    return this.checkVictory(next, playerId);
  }

  private addStatus(
    state: GameStateEntity,
    playerId: number,
    status: OlympiaStatus,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const statuses = { ...(meta.statuses ?? {}) };
    const playerStatuses = [...(statuses[playerId] ?? [])];
    playerStatuses.push(status);
    statuses[playerId] = playerStatuses;
    return this.setMeta(state, { ...meta, statuses });
  }

  private addSkip(state: GameStateEntity, playerId: number, turns: number): GameStateEntity {
    const meta = this.getMeta(state);
    const skipTurn = { ...(meta.skipTurn ?? {}) };
    skipTurn[playerId] = (skipTurn[playerId] ?? 0) + turns;
    return this.setMeta(state, { ...meta, skipTurn });
  }

  private discardRandom(
    state: GameStateEntity,
    playerId: number,
    amount: number,
    categories?: string[],
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const hand = Array.isArray(meta.hands?.[playerId]) ? [...meta.hands![playerId]] : [];
    if (!hand.length) return state;
    const discardList = [...(meta.discard ?? [])];
    const removed: string[] = [];
    for (let i = 0; i < amount && hand.length; i += 1) {
      const cardId = hand.shift()!;
      discardList.push(cardId);
      removed.push(cardId);
    }
    const next = this.setMeta(state, {
      ...meta,
      hands: { ...meta.hands, [playerId]: hand },
      discard: discardList,
    });
    if (removed.length) {
      return this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} dÃ©fausse ${removed.length} carte(s).`,
      );
    }
    return next;
  }

  private exchangeCard(
    state: GameStateEntity,
    actorId: number,
    targetId: number,
    categories: string[],
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const actorHand = Array.isArray(meta.hands?.[actorId])
      ? [...meta.hands![actorId]]
      : [];
    const targetHand = Array.isArray(meta.hands?.[targetId])
      ? [...meta.hands![targetId]]
      : [];
    const actorCard = actorHand.find((cardId) =>
      categories.includes(OLYMPIA_CARD_BY_ID[cardId]?.category as string),
    );
    const targetCard = targetHand.shift();
    if (!actorCard || !targetCard) return state;
    actorHand.splice(actorHand.indexOf(actorCard), 1);
    actorHand.push(targetCard);
    targetHand.push(actorCard);
    return this.setMeta(state, {
      ...meta,
      hands: {
        ...meta.hands,
        [actorId]: actorHand,
        [targetId]: targetHand,
      },
    });
  }

  private applySteal(
    state: GameStateEntity,
    actorId: number,
    amount: number,
  ): GameStateEntity {
    const players = Array.isArray(state.players) ? state.players : [];
    const opponents = players.filter((p) => p?.id != null && p.id !== actorId);
    if (!opponents.length) return state;
    const target = opponents[0]!;
    let next = this.addPrestige(state, actorId, amount);
    next = this.addPrestige(next, target.id, -amount);
    return this.core.appendLog(
      next,
      `${this.playerName(next, actorId)} vole ${amount} point(s) Ã  ${this.playerName(next, target.id)}.`,
    );
  }

  private drawForPlayer(
    state: GameStateEntity,
    playerId: number,
    amount: number,
    decks: OlympiaDeckType[],
  ): GameStateEntity {
    let next = state;
    for (let i = 0; i < amount; i += 1) {
      for (const deck of decks) {
        const meta = this.getMeta(next);
        const entry = this.drawOneCard(meta, deck);
        if (!entry.cardId) continue;
        next = this.setMeta(next, this.addCardToHand(entry.meta, playerId, entry.cardId));
        next = this.core.appendLog(
          next,
          `${this.playerName(next, playerId)} pioche ${this.getCardName(entry.cardId)} (${deck}).`,
        );
        break;
      }
    }
    return next;
  }

  private drawOneCard(
    meta: OlympiaMetadata,
    deck: OlympiaDeckType,
  ): { cardId: string | null; meta: OlympiaMetadata } {
    const pile = [...(meta.decks?.[deck] ?? [])];
    if (!pile.length) {
      return { cardId: null, meta };
    }
    const [cardId, ...rest] = pile;
    const nextMeta: OlympiaMetadata = {
      ...meta,
      decks: { ...meta.decks, [deck]: rest },
    };
    return { cardId, meta: nextMeta };
  }

  private removeCardFromHand(
    meta: OlympiaMetadata,
    playerId: number,
    cardId: string,
  ): OlympiaMetadata {
    const hands = { ...(meta.hands ?? {}) };
    const playerHand = Array.isArray(hands[playerId]) ? [...hands[playerId]] : [];
    const index = playerHand.indexOf(cardId);
    if (index >= 0) {
      playerHand.splice(index, 1);
    }
    hands[playerId] = playerHand;
    return { ...meta, hands };
  }

  private addCardToHand(
    meta: OlympiaMetadata,
    playerId: number,
    cardId: string,
  ): OlympiaMetadata {
    const hands = { ...(meta.hands ?? {}) };
    const playerHand = [...(hands[playerId] ?? [])];
    playerHand.push(cardId);
    hands[playerId] = playerHand;
    return { ...meta, hands };
  }

  private addCardToDiscard(
    meta: OlympiaMetadata,
    cardId: string,
  ): OlympiaMetadata {
    const discard = [...(meta.discard ?? []), cardId];
    return { ...meta, discard };
  }

  private checkVictory(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const prestige = meta.prestige ?? {};
    if ((prestige[playerId] ?? 0) >= VICTORY_PRESTIGE) {
      return {
        ...state,
        status: 'finished',
        metadata: { ...meta, winnerId: playerId },
      };
    }
    return state;
  }

  private advanceAndTick(state: GameStateEntity): GameStateEntity {
    let next = this.turns.advanceTurn(state);
    next = this.cleanStatuses(next);
    return next;
  }

  private cleanStatuses(state: GameStateEntity): GameStateEntity {
    const meta = this.getMeta(state);
    const statuses: Record<number, OlympiaStatus[]> = {};
    for (const [playerId, list] of Object.entries(meta.statuses ?? {})) {
      const reduced = (list ?? [])
        .map((entry) => ({ ...entry, turns: entry.turns - 1 }))
        .filter((entry) => entry.turns > 0);
      statuses[Number(playerId)] = reduced;
    }
    return this.setMeta(state, { ...meta, statuses });
  }

  private getMeta(state: GameStateEntity): OlympiaMetadata {
    return (state.metadata ?? {}) as OlympiaMetadata;
  }

  private setMeta(
    state: GameStateEntity,
    metadata: OlympiaMetadata,
  ): GameStateEntity {
    return { ...state, metadata };
  }

  private getCardName(cardId: string): string {
    return OLYMPIA_CARD_BY_ID[cardId]?.name ?? cardId;
  }

  private playerName(state: GameStateEntity, playerId: number): string {
    const players = Array.isArray(state.players) ? state.players : [];
    const player = players.find((p) => p?.id === playerId);
    return player?.username?.trim() || `Joueur ${playerId}`;
  }
}
