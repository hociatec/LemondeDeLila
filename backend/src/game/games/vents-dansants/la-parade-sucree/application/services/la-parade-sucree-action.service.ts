import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type { GameSingleActionDto } from '../../../../../application/models/game-action.model';
import { resolvePlayerNameFromState } from '../../../../../application/helpers/player-name.helper';

import { GameCoreService } from '../../../../../application/services/game-core.service';
import { TurnFlowService } from '../../../../../application/services/turn-flow.service';
import {
  CANDY_VALUES,
  LA_PARADE_CARD_BY_ID,
  LA_PARADE_SEQUENCE,
  LA_PARADE_SPECIAL_REWARDS,
} from '../../model/la-parade-sucree-cards';
import {
  applyActionsSequentially,
  dispatchByActionType,
  normalizeActionType,
} from '../../../../../application/helpers/action-service.helper';
import type {
  CandyCounts,
  LaParadeSucreeMetadata,
} from '../../model/la-parade-sucree-state.model';
import {
  addLaParadePlayed,
  computeLaParadeCandyValue,
  determineLaParadeWinner,
  isLaParadeGameFinished,
  removeLaParadeCardFromHand,
} from './la-parade-sucree-action.utils';

type LaParadeActionPayload = {
  cardId?: string | null;
};

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
    const hand = Array.isArray(meta.hands?.[currentId])
      ? meta.hands[currentId]
      : [];
    if (!hand.includes(cardId)) return state;

    const sequenceValue = LA_PARADE_SEQUENCE[meta.sequenceIndex];
    if (definition.value !== sequenceValue) {
      return state;
    }

    let nextMeta = removeLaParadeCardFromHand(meta, currentId, cardId);
    nextMeta = addLaParadePlayed(nextMeta, cardId);
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
    if (isLaParadeGameFinished(updatedMeta)) {
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
      playerCandies[candyType] =
        (playerCandies[candyType] ?? 0) + (amount ?? 0);
    }
    candies[playerId] = playerCandies;
    let next = this.setMeta(state, { ...meta, candies });
    const gainValue = computeLaParadeCandyValue(reward);
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} rafle les friandises de la case ${value} (+${gainValue}).`,
    );
    return next;
  }

  private finishGame(state: GameStateEntity): GameStateEntity {
    const meta = this.getMeta(state);
    const winnerId = determineLaParadeWinner(meta);
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



