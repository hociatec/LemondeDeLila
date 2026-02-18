import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { resolvePlayerNameFromState } from '../../../../modules/turn-policies/player-name.helper';


import { GameCoreService } from '../../../../core/services/game-core.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import {
  CANDY_VALUES,
  LA_PARADE_CARD_BY_ID,
  LA_PARADE_SEQUENCE,
  LA_PARADE_SPECIAL_REWARDS,
} from '../model/la-parade-sucree-cards';
import { applyActionsSequentially, dispatchByActionType, normalizeActionType } from '../../../../actions/action-service.helper';
import type {
  CandyCounts,
  LaParadeSucreeMetadata,
} from '../model/la-parade-sucree-state.entity';

type LaParadeActionPayload = {
  cardId?: string | null;
};

@Injectable()
export class LaParadeSucreeActionService {
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
          play_card: () => this.handlePlayCard(next, action),
          pass: () => this.handlePass(next),
        },
        () => next,
      );
    });
  }

  private handlePlayCard(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    const payload = (action.payload ?? {}) as LaParadeActionPayload;
    const cardId = String(payload.cardId ?? '').trim();
    if (!cardId) return state;

    const definition = LA_PARADE_CARD_BY_ID[cardId];
    if (!definition) return state;

    const meta = this.getMeta(state);
    const hand = Array.isArray(meta.hands?.[currentId]) ? meta.hands[currentId] : [];
    if (!hand.includes(cardId)) return state;

    const sequenceValue = LA_PARADE_SEQUENCE[meta.sequenceIndex];
    if (definition.value !== sequenceValue) {
      return state;
    }

    let nextMeta = this.removeCardFromHand(meta, currentId, cardId);
    nextMeta = this.addPlayed(nextMeta, cardId);
    nextMeta = { ...nextMeta, sequenceIndex: meta.sequenceIndex + 1 };
    let next = this.setMeta(state, nextMeta);
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, currentId)} pose ${definition.name} (${definition.value}).`,
    );

    if (definition.special) {
      next = this.applySpecialReward(next, currentId, definition.value);
    }

    const updatedMeta = this.getMeta(next);
    if (this.isGameFinished(updatedMeta)) {
      return this.finishGame(next);
    }

    return next;
  }

  private handlePass(state: GameStateEntity): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;
    let next = this.core.appendLog(
      state,
      `${resolvePlayerNameFromState(state, currentId)} passe son tour.`,
    );
    next = this.turns.advanceTurn(next);
    return next;
  }

  private applySpecialReward(
    state: GameStateEntity,
    playerId: number,
    value: string,
  ): GameStateEntity {
    const reward = LA_PARADE_SPECIAL_REWARDS[value];
    if (!reward) return state;
    const meta = this.getMeta(state);
    const candies = { ...(meta.candies ?? {}) };
    const playerCandies: CandyCounts = {
      ...(candies[playerId] ?? { Chamallow: 0, Chocobon: 0, Balisto: 0 }),
    };
    for (const [type, amount] of Object.entries(reward)) {
      const candyType = type as keyof CandyCounts;
      playerCandies[candyType] = (playerCandies[candyType] ?? 0) + (amount ?? 0);
    }
    candies[playerId] = playerCandies;
    let next = this.setMeta(state, { ...meta, candies });
    const gainValue = this.computeCandyValue(reward);
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} rafle les friandises de la case ${value} (+${gainValue}).`,
    );
    return next;
  }

  private computeCandyValue(reward: Partial<Record<string, number>>): number {
    let total = 0;
    for (const [key, amount] of Object.entries(reward)) {
      const candyType = key as keyof typeof CANDY_VALUES;
      total += (CANDY_VALUES[candyType] ?? 0) * (amount ?? 0);
    }
    return total;
  }

  private addPlayed(
    meta: LaParadeSucreeMetadata,
    cardId: string,
  ): LaParadeSucreeMetadata {
    const played = [...(meta.played ?? []), cardId];
    return { ...meta, played };
  }

  private removeCardFromHand(
    meta: LaParadeSucreeMetadata,
    playerId: number,
    cardId: string,
  ): LaParadeSucreeMetadata {
    const hands = { ...(meta.hands ?? {}) };
    const playerHand = Array.isArray(hands[playerId]) ? [...hands[playerId]] : [];
    const index = playerHand.indexOf(cardId);
    if (index >= 0) {
      playerHand.splice(index, 1);
    }
    hands[playerId] = playerHand;
    return { ...meta, hands };
  }

  private isGameFinished(meta: LaParadeSucreeMetadata): boolean {
    const allPlayed = meta.sequenceIndex >= LA_PARADE_SEQUENCE.length;
    const noCardsLeft = Object.values(meta.hands ?? {}).every(
      (hand) => Array.isArray(hand) && hand.length === 0,
    );
    return allPlayed || noCardsLeft;
  }

  private finishGame(state: GameStateEntity): GameStateEntity {
    const meta = this.getMeta(state);
    const winnerId = this.determineWinner(meta);
    const next = {
      ...state,
      status: 'finished',
      metadata: { ...meta, winnerId },
    };
    return this.core.appendLog(
      next,
      winnerId
        ? `${resolvePlayerNameFromState(next, winnerId)} rafle la Parade Sucrée !`
        : 'Match nul gourmand !',
    );
  }

  private determineWinner(meta: LaParadeSucreeMetadata): number | null {
    let bestId: number | null = null;
    let bestScore = -Infinity;
    let tie = false;
    for (const [playerIdStr, candies] of Object.entries(meta.candies ?? {})) {
      const playerId = Number(playerIdStr);
      const value = this.scoreCandies(candies);
      if (value > bestScore) {
        bestScore = value;
        bestId = playerId;
        tie = false;
        continue;
      }
      if (value === bestScore) {
        tie = true;
      }
    }
    return tie ? null : bestId;
  }

  private scoreCandies(candies?: CandyCounts): number {
    if (!candies) return 0;
    let total = 0;
    for (const [type, amount] of Object.entries(candies)) {
      const candyType = type as keyof typeof CANDY_VALUES;
      total += (CANDY_VALUES[candyType] ?? 0) * (amount ?? 0);
    }
    return total;
  }

  private getMeta(state: GameStateEntity): LaParadeSucreeMetadata {
    return (state.metadata ?? {}) as LaParadeSucreeMetadata;
  }

  private setMeta(
    state: GameStateEntity,
    metadata: LaParadeSucreeMetadata,
  ): GameStateEntity {
    return { ...state, metadata };
  }
}

