import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { resolvePlayerNameFromState } from '../../../../modules/turn-policies/player-name.helper';

import { GameCoreService } from '../../../../core/services/game-core.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { DeckPoliciesService } from '../../../../modules/deck-policies/services/deck-policies.service';
import { DAME_NATURE_CARD_BY_ID } from '../model/dame-nature-cards';
import type { DameNatureMetadata } from '../model/dame-nature-state.entity';
import type { DameNatureActionPayload } from '../rulebook/rulebook';

import {
  applyActionsSequentially,
  dispatchByActionType,
  normalizeActionType,
} from '../../../../actions/action-service.helper';
@Injectable()
export class DameNatureActionService {
  constructor(
    private readonly core: GameCoreService,
    private readonly turns: TurnFlowService,
    private readonly deckPolicies: DeckPoliciesService,
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
          ask_card: () => this.handleAskCard(next, action),
          pass: () => this.handlePass(next),
        },
        () => next,
      );
    });
  }

  private handlePass(state: GameStateEntity): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;
    const next = this.turns.advanceTurn(state);
    return next;
  }

  private handleAskCard(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;
    const payload = (action.payload ?? {}) as DameNatureActionPayload;
    const targetId = payload.targetPlayerId ?? null;
    const cardId = String(payload.cardId ?? '').trim();
    if (!targetId || !cardId) return state;

    const cardDefinition = DAME_NATURE_CARD_BY_ID[cardId];
    if (!cardDefinition || cardDefinition.type !== 'family') return state;

    const meta = this.getMeta(state);
    if (!this.playerHasCard(meta, targetId, cardId)) {
      return this.drawAndAdvance(
        state,
        currentId,
        `La carte ${this.getCardName(cardId)} n'est pas chez le joueur demand�.`,
      );
    }

    let next = this.transferCardBetweenPlayers(
      state,
      targetId,
      currentId,
      cardId,
    );
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, currentId)} r�cup�re ${this.getCardName(cardId)} de ${resolvePlayerNameFromState(next, targetId)}.`,
    );

    next = this.registerFamilyCard(next, currentId, cardId);
    next = this.checkVictory(next, currentId);
    return next;
  }

  private drawAndAdvance(
    state: GameStateEntity,
    playerId: number,
    reason: string,
  ): GameStateEntity {
    let next = this.core.appendLog(state, reason);
    next = this.drawCardForPlayer(next, playerId);
    if (this.isGameFinished(next)) return next;
    next = this.turns.advanceTurn(next);
    return next;
  }

  private drawCardForPlayer(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const { cardId, meta: updatedMeta } = this.drawOneCard(meta);
    let next = this.setMeta(state, updatedMeta);
    if (!cardId) {
      return this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} ne trouve plus aucune carte � piocher.`,
      );
    }

    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} pioche ${this.getCardName(cardId)}.`,
    );

    const definition = DAME_NATURE_CARD_BY_ID[cardId];
    if (!definition) return next;

    if (definition.type === 'family') {
      next = this.addCardToHand(next, playerId, cardId);
      next = this.registerFamilyCard(next, playerId, cardId);
      next = this.checkVictory(next, playerId);
      return next;
    }

    if (definition.type === 'quiz') {
      next = this.addCardToDiscard(next, cardId);
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} lit le quiz : ${definition.question}`,
      );
      next = this.setLastQuiz(next, cardId);
      return next;
    }

    if (definition.type === 'nature') {
      next = this.addCardToDiscard(next, cardId);
      next = this.applyNatureEffect(
        next,
        playerId,
        definition.delta,
        definition.description,
      );
      return next;
    }

    return next;
  }

  private registerFamilyCard(
    state: GameStateEntity,
    playerId: number,
    cardId: string,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const definition = DAME_NATURE_CARD_BY_ID[cardId];
    if (!definition || definition.type !== 'family') return state;
    const familyId = definition.familyId;
    const families = { ...(meta.families ?? {}) };
    const playerFamilies = { ...(families[playerId] ?? {}) };
    const list = [...(playerFamilies[familyId] ?? [])];
    if (!list.includes(cardId)) {
      list.push(cardId);
    }
    playerFamilies[familyId] = list;
    families[playerId] = playerFamilies;
    return this.setMeta(state, { ...meta, families });
  }

  private transferCardBetweenPlayers(
    state: GameStateEntity,
    fromId: number,
    toId: number,
    cardId: string,
  ): GameStateEntity {
    let next = this.removeCardFromHand(state, fromId, cardId);
    next = this.addCardToHand(
      this.setMeta(
        next,
        this.removeFamilyCard(this.getMeta(next), fromId, cardId),
      ),
      toId,
      cardId,
    );
    return next;
  }

  private applyNatureEffect(
    state: GameStateEntity,
    playerId: number,
    delta: number,
    description: string,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const current = Math.max(0, (meta.pollutionTokens ?? 0) + delta);
    const pollution = Math.min(12, current);
    meta = { ...meta, pollutionTokens: pollution };
    next = this.setMeta(next, meta);
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} subit : ${description} (${delta >= 0 ? '+' : ''}${delta} jetons pollution).`,
    );
    if (pollution >= 12) {
      next = {
        ...next,
        status: 'finished',
        metadata: { ...meta, winnerId: null, pollutionLoserId: playerId },
      };
    }
    return next;
  }

  private checkVictory(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    if (this.isGameFinished(state)) return state;
    const completed = this.getCompletedFamilyCount(
      this.getMeta(state),
      playerId,
    );
    if (completed >= 4) {
      const meta = this.getMeta(state);
      return {
        ...state,
        status: 'finished',
        metadata: { ...meta, winnerId: playerId },
      };
    }
    return state;
  }

  private getCompletedFamilyCount(
    meta: DameNatureMetadata,
    playerId: number,
  ): number {
    const playerFamilies = meta.families?.[playerId] ?? {};
    return Object.values(playerFamilies).filter((cards) => cards.length >= 6)
      .length;
  }

  private drawOneCard(meta: DameNatureMetadata): {
    cardId: string | null;
    meta: DameNatureMetadata;
  } {
    const draw = this.deckPolicies.drawOne<string, DameNatureMetadata>({
      meta,
      deckKey: 'deck',
      discardKey: 'discard',
      rngKey: 'rng',
    });
    return { cardId: draw.card, meta: draw.meta };
  }

  private addCardToHand(
    state: GameStateEntity,
    playerId: number,
    cardId: string,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const hands = { ...(meta.hands ?? {}) };
    const playerHand = [...(hands[playerId] ?? [])];
    playerHand.push(cardId);
    hands[playerId] = playerHand;
    return this.setMeta(state, { ...meta, hands });
  }

  private removeCardFromHand(
    state: GameStateEntity,
    playerId: number,
    cardId: string,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const hands = { ...(meta.hands ?? {}) };
    const playerHand = [...(hands[playerId] ?? [])];
    const index = playerHand.indexOf(cardId);
    if (index >= 0) {
      playerHand.splice(index, 1);
    }
    hands[playerId] = playerHand;
    return this.setMeta(state, { ...meta, hands });
  }

  private addCardToDiscard(
    state: GameStateEntity,
    cardId: string,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const discard = [...(meta.discard ?? []), cardId];
    return this.setMeta(state, { ...meta, discard });
  }

  private removeFamilyCard(
    meta: DameNatureMetadata,
    playerId: number,
    cardId: string,
  ): DameNatureMetadata {
    const definition = DAME_NATURE_CARD_BY_ID[cardId];
    if (!definition || definition.type !== 'family') return meta;
    const families = { ...(meta.families ?? {}) };
    const playerFamilies = { ...(families[playerId] ?? {}) };
    const familyId = definition.familyId;
    const playerCards = [...(playerFamilies[familyId] ?? [])];
    const index = playerCards.indexOf(cardId);
    if (index >= 0) {
      playerCards.splice(index, 1);
    }
    playerFamilies[familyId] = playerCards;
    families[playerId] = playerFamilies;
    return { ...meta, families };
  }

  private setLastQuiz(state: GameStateEntity, cardId: string): GameStateEntity {
    const meta = this.getMeta(state);
    return this.setMeta(state, { ...meta, lastQuizCardId: cardId });
  }

  private setMeta(
    state: GameStateEntity,
    metadata: DameNatureMetadata,
  ): GameStateEntity {
    return { ...state, metadata };
  }

  private getMeta(state: GameStateEntity): DameNatureMetadata {
    return (state.metadata ?? {}) as DameNatureMetadata;
  }

  private playerHasCard(
    meta: DameNatureMetadata,
    playerId: number,
    cardId: string,
  ): boolean {
    return (
      Array.isArray(meta.hands?.[playerId]) &&
      meta.hands[playerId].includes(cardId)
    );
  }

  private getCardName(cardId: string): string {
    const definition = DAME_NATURE_CARD_BY_ID[cardId];
    if (!definition) return cardId;
    if (definition.type === 'family') {
      return `${definition.familyName} (${definition.memberName})`;
    }
    if (definition.type === 'quiz') {
      return `Quiz : ${definition.question}`;
    }
    if (definition.type === 'nature') {
      return `Nature : ${definition.description}`;
    }
    return cardId;
  }

  private isGameFinished(state: GameStateEntity): boolean {
    return String(state.status ?? '').toLowerCase() === 'finished';
  }
}
