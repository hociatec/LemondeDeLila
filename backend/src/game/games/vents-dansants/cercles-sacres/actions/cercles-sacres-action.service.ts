import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { resolvePlayerNameFromState } from '../../../../modules/turn-policies/player-name.helper';


import { GameCoreService } from '../../../../core/services/game-core.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { DeckPoliciesService } from '../../../../modules/deck-policies/services/deck-policies.service';
import type { CerclesSacresTheme } from '../model/cercles-sacres-cards';
import { CERCLES_SACRES_CARD_BY_ID } from '../model/cercles-sacres-cards';
import type {
  CerclesSacresCircle,
  CerclesSacresMetadata,
} from '../model/cercles-sacres-state.entity';
import { applyActionsSequentially, dispatchByActionType, normalizeActionType } from '../../../../actions/action-service.helper';


import {
  CERCLES_SACRES_GOAL,
  CERCLES_SACRES_HAND_MIN,
} from '../model/cercles-sacres-state.entity';

type CerclesSacresActionPayload = {
  cardId?: string | null;
  cardIds?: string[] | null;
};

@Injectable()
export class CerclesSacresActionService {
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
          discard_card: () => this.handleDiscardCard(next, action),
          form_circle: () => this.handleFormCircle(next, action),
          pass: () => this.handlePass(next, action),
        },
        () => next,
      );
    });
  }

  private handlePass(
    state: GameStateEntity,
    _action: GameSingleActionDto,
  ): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;
    let next = this.ensurePlayerDrawn(state, currentId);
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, currentId)} passe son tour.`,
    );
    next = this.turns.advanceTurn(next);
    return this.clearDrawn(next);
  }

  private handleDiscardCard(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;
    let next = this.ensurePlayerDrawn(state, currentId);
    const payload = (action.payload ?? {}) as CerclesSacresActionPayload;
    const cardId = String(payload.cardId ?? '').trim();
    if (!cardId) return next;

    const meta = this.getMeta(next);
    const hand = Array.isArray(meta.hands?.[currentId])
      ? [...meta.hands[currentId]]
      : [];
    if (!hand.includes(cardId)) return next;

    let updatedMeta = this.removeCardFromHand(meta, currentId, cardId);
    updatedMeta = this.addCardToDiscard(updatedMeta, cardId);
    next = this.setMeta(next, updatedMeta);

    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, currentId)} défausse ${CERCLES_SACRES_CARD_BY_ID[cardId]?.name ?? 'une carte'}.`,
    );

    return next;
  }

  private handleFormCircle(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;
    let next = this.ensurePlayerDrawn(state, currentId);
    const payload = (action.payload ?? {}) as CerclesSacresActionPayload;
    const cardIds = Array.isArray(payload.cardIds)
      ? payload.cardIds.filter((id) => Boolean(id))
      : [];
    if (cardIds.length !== 6) return next;

    const meta = this.getMeta(next);
    const hand = Array.isArray(meta.hands?.[currentId])
      ? [...meta.hands[currentId]]
      : [];
    if (!cardIds.every((cardId) => hand.includes(cardId))) {
      return next;
    }

    let updatedMeta = this.removeCardsFromHand(meta, currentId, cardIds);
    const playerCircles = [...(updatedMeta.circles?.[currentId] ?? [])];
    const circleThemes = cardIds.reduce<Record<CerclesSacresTheme, string>>(
      (acc, cardId) => {
        const definition = CERCLES_SACRES_CARD_BY_ID[cardId];
        if (definition) {
          acc[definition.theme] = cardId;
        }
        return acc;
      },
      {} as Record<CerclesSacresTheme, string>,
    );
    const circle: CerclesSacresCircle = {
      id: `circle-${currentId}-${playerCircles.length + 1}`,
      cards: cardIds,
      themes: circleThemes as Record<CerclesSacresTheme, string>,
    };

    playerCircles.push(circle);
    const circles = { ...(updatedMeta.circles ?? {}), [currentId]: playerCircles };
    updatedMeta = { ...updatedMeta, circles };
    next = this.setMeta(next, updatedMeta);

    const cardNames = cardIds
      .map((cardId) => CERCLES_SACRES_CARD_BY_ID[cardId]?.name ?? cardId)
      .join(', ');
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, currentId)} pose son cercle sacré n°${playerCircles.length} (${cardNames}).`,
    );

    next = this.fillHandToMinimum(next, currentId);

    if (playerCircles.length >= CERCLES_SACRES_GOAL) {
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, currentId)} devient Gardien des Cercles avec ${CERCLES_SACRES_GOAL} cercles !`,
      );
      const metaAfter = this.getMeta(next);
      return {
        ...next,
        status: 'finished',
        metadata: {
          ...metaAfter,
          winnerId: currentId,
        },
      };
    }

    next = this.turns.advanceTurn(next);
    return this.clearDrawn(next);
  }

  private fillHandToMinimum(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    let meta = this.getMeta(state);
    let hand = Array.isArray(meta.hands?.[playerId])
      ? [...meta.hands[playerId]]
      : [];
    if (hand.length >= CERCLES_SACRES_HAND_MIN) {
      return state;
    }

    const drawnCards: string[] = [];
    while (hand.length < CERCLES_SACRES_HAND_MIN) {
      const { cardId, meta: updatedMeta } = this.drawOneCard(meta);
      meta = updatedMeta;
      if (!cardId) break;
      drawnCards.push(cardId);
      hand = [...hand, cardId];
      const hands = { ...(meta.hands ?? {}) };
      hands[playerId] = hand;
      meta = { ...meta, hands };
    }

    let next = this.setMeta(state, meta);
    if (drawnCards.length) {
      const names = drawnCards
        .map((id) => CERCLES_SACRES_CARD_BY_ID[id]?.name ?? 'une carte')
        .join(', ');
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} complète sa main (${drawnCards.length} carte(s)) : ${names}.`,
      );
    }
    return next;
  }

  private ensurePlayerDrawn(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    if (meta.drawnPlayerId === playerId) return state;
    const { meta: updatedMeta, cardId } = this.drawForPlayer(meta, playerId);
    const next = this.setMeta(state, {
      ...updatedMeta,
      drawnPlayerId: playerId,
    });
    if (cardId) {
      return this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} pioche ${CERCLES_SACRES_CARD_BY_ID[cardId]?.name ?? 'une carte'}.`,
      );
    }
    return next;
  }

  private drawForPlayer(
    meta: CerclesSacresMetadata,
    playerId: number,
  ): { meta: CerclesSacresMetadata; cardId: string | null } {
    const { cardId, meta: withCard } = this.drawOneCard(meta);
    if (!cardId) {
      return { meta: withCard, cardId: null };
    }
    const hands = { ...(withCard.hands ?? {}) };
    const playerHand = [...(hands[playerId] ?? [])];
    playerHand.push(cardId);
    hands[playerId] = playerHand;
    return {
      cardId,
      meta: {
        ...withCard,
        hands,
      },
    };
  }

  private drawOneCard(
    meta: CerclesSacresMetadata,
  ): { cardId: string | null; meta: CerclesSacresMetadata } {
    const draw = this.deckPolicies.drawOne<string, CerclesSacresMetadata>({
      meta,
      deckKey: 'deck',
      discardKey: 'discard',
      rngKey: 'rng',
    });
    return {
      cardId: draw.card,
      meta: draw.meta,
    };
  }

  private removeCardsFromHand(
    meta: CerclesSacresMetadata,
    playerId: number,
    cardIds: string[],
  ): CerclesSacresMetadata {
    let hands = { ...(meta.hands ?? {}) };
    const playerHand = Array.isArray(hands[playerId])
      ? [...hands[playerId]]
      : [];
    for (const cardId of cardIds) {
      const index = playerHand.indexOf(cardId);
      if (index >= 0) {
        playerHand.splice(index, 1);
      }
    }
    hands[playerId] = playerHand;
    return { ...meta, hands };
  }

  private removeCardFromHand(
    meta: CerclesSacresMetadata,
    playerId: number,
    cardId: string,
  ): CerclesSacresMetadata {
    let hands = { ...(meta.hands ?? {}) };
    const playerHand = Array.isArray(hands[playerId])
      ? [...hands[playerId]]
      : [];
    const index = playerHand.indexOf(cardId);
    if (index >= 0) {
      playerHand.splice(index, 1);
    }
    hands[playerId] = playerHand;
    return { ...meta, hands };
  }

  private addCardToDiscard(
    meta: CerclesSacresMetadata,
    cardId: string,
  ): CerclesSacresMetadata {
    const discard = [...(meta.discard ?? []), cardId];
    return { ...meta, discard };
  }

  private clearDrawn(state: GameStateEntity): GameStateEntity {
    const meta = this.getMeta(state);
    return this.setMeta(state, { ...meta, drawnPlayerId: null });
  }

  private getMeta(state: GameStateEntity): CerclesSacresMetadata {
    return (state.metadata ?? {}) as CerclesSacresMetadata;
  }

  private setMeta(
    state: GameStateEntity,
    metadata: CerclesSacresMetadata,
  ): GameStateEntity {
    return { ...state, metadata };
  }
}



