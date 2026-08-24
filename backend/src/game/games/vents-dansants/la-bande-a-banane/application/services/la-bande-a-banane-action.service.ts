import type { GameStateEntity } from '../../../../application/models/game-state.model';
import type { GameSingleActionDto } from '../../../../models/game-action.model';
import { resolvePlayerNameFromState } from '../../../../application/helpers/player-name.helper';

import { GameCoreService } from '../../../../application/services/game-core.service';
import { TurnFlowService } from '../../../../application/services/turn-flow.service';
import { RandomService } from '../../../../application/services/random.service';
import { DeckPoliciesService } from '../../../../application/features/deck-policies/services/deck-policies.service';
import {
  BANDE_A_BANANE_CARD_BY_ID,
  BandeABananeCardDefinition,
} from '../../model/la-bande-a-banane-cards';
import {
  applyActionsSequentially,
  dispatchByActionType,
  normalizeActionType,
} from '../../../../application/helpers/action-service.helper';
import type {
  BandeABananeMetadata,
  BandeABananeTroopEntry,
} from '../../model/la-bande-a-banane-state.model';
import type { BandeABananeActionPayload } from '../../rulebook/rulebook';
import {
  addBandeABananeCardToDiscard,
  addBandeABananeCardToHand,
  drawOneBandeABananeCard,
  getBandeABananeCardName,
  getBandeABananePlayerHand,
  removeBandeABananeCardFromHand,
} from './la-bande-a-banane-action.utils';

export class BandeABananeActionService {
  private static readonly HAND_LIMIT = 7;

  constructor(
    private readonly core: GameCoreService,
    private readonly turns: TurnFlowService,
    private readonly random: RandomService,
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
    let next = this.ensurePlayerDrawn(state, currentId);
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, currentId)} passe son tour.`,
    );
    next = this.turns.advanceTurn(next);
    return this.clearDrawn(next);
  }

  private handlePlayCard(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;
    let next = this.ensurePlayerDrawn(state, currentId);
    const payload = (action.payload ?? {}) as BandeABananeActionPayload;
    const cardId = String(payload.cardId ?? '').trim();
    if (!cardId) return next;

    const definition = BANDE_A_BANANE_CARD_BY_ID[cardId];
    if (!definition) return next;

    const meta = this.getMeta(next);
    if (!this.playerHasCard(meta, currentId, cardId)) return next;

    let updatedMeta = this.removeCardFromHand(meta, currentId, cardId);
    updatedMeta = this.addCardToDiscard(updatedMeta, cardId);
    next = this.setMeta(next, updatedMeta);

    switch (definition.type) {
      case 'monkey':
        next = this.playMonkey(next, currentId, definition);
        break;
      case 'joker':
        next = this.playJoker(
          next,
          currentId,
          definition,
          payload.species ?? null,
        );
        break;
      case 'action':
        next = this.playAction(next, currentId, definition, payload);
        break;
      case 'trap':
        next = this.playTrap(next, currentId, definition);
        break;
    }

    next = this.enforceHandLimit(next, currentId);

    if ((this.getMeta(next).winnerId ?? null) != null) {
      return next;
    }

    next = this.turns.advanceTurn(next);
    return this.clearDrawn(next);
  }

  private playMonkey(
    state: GameStateEntity,
    playerId: number,
    card: BandeABananeCardDefinition,
  ): GameStateEntity {
    return this.addCardToTroop(
      state,
      playerId,
      card.id,
      card.species ?? null,
      false,
    );
  }

  private playJoker(
    state: GameStateEntity,
    playerId: number,
    card: BandeABananeCardDefinition,
    species: string | null,
  ): GameStateEntity {
    return this.addCardToTroop(state, playerId, card.id, species, true);
  }

  private playAction(
    state: GameStateEntity,
    playerId: number,
    card: BandeABananeCardDefinition,
    payload: BandeABananeActionPayload,
  ): GameStateEntity {
    if (card.action === 'vol-de-banane') {
      return this.playVol(state, playerId, payload.targetPlayerId ?? null);
    }
    if (card.action === 'cris-de-la-jungle') {
      return this.playCris(
        state,
        playerId,
        payload.targetPlayerId ?? null,
        payload.cardToGiveId ?? null,
      );
    }
    if (card.action === 'grimpeur-fou') {
      return this.playGrimpeur(state, playerId);
    }
    return state;
  }

  private playTrap(
    state: GameStateEntity,
    playerId: number,
    card: BandeABananeCardDefinition,
  ): GameStateEntity {
    if (card.trap === 'piege-a-noix-de-coco') {
      let next = this.addSkipTurns(state, playerId, 1);
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} se prend une noix de coco et perd son prochain tour.`,
      );
      return next;
    }
    if (card.trap === 'tigre-rodeur') {
      let next = this.discardRandomCard(state, playerId);
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} chute sur un tigre et lÃƒÆ’Ã‚Â¢che une carte.`,
      );
      return next;
    }
    return state;
  }

  private playVol(
    state: GameStateEntity,
    playerId: number,
    targetId: number | null,
  ): GameStateEntity {
    if (targetId == null) return state;
    const meta = this.getMeta(state);
    const targetHand = this.getPlayerHand(meta, targetId);
    if (!targetHand.length) return state;
    const { index, meta: updatedRng } = this.random.pickIndex(
      meta.rng ?? {},
      targetHand.length,
    );
    const stolen = targetHand[index];
    let nextMeta: BandeABananeMetadata = { ...meta, rng: updatedRng };
    nextMeta = this.removeCardFromHand(nextMeta, targetId, stolen);
    nextMeta = this.addCardToHand(nextMeta, playerId, stolen);
    let next = this.setMeta(state, nextMeta);
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} vole ${this.getCardName(stolen)} ÃƒÆ’Ã‚Â  ${resolvePlayerNameFromState(
        next,
        targetId,
      )}.`,
    );
    return next;
  }

  private playCris(
    state: GameStateEntity,
    playerId: number,
    targetId: number | null,
    giveCardId: string | null,
  ): GameStateEntity {
    if (targetId == null || !giveCardId) return state;
    let next = state;
    let nextMeta = this.getMeta(next);
    if (!this.playerHasCard(nextMeta, playerId, giveCardId)) {
      return next;
    }
    nextMeta = this.removeCardFromHand(nextMeta, playerId, giveCardId);

    const originalTargetHand = this.getPlayerHand(nextMeta, targetId);
    if (originalTargetHand.length) {
      const { index, meta: updatedRng } = this.random.pickIndex(
        nextMeta.rng ?? {},
        originalTargetHand.length,
      );
      const returned = originalTargetHand[index];
      nextMeta = { ...nextMeta, rng: updatedRng };
      nextMeta = this.removeCardFromHand(nextMeta, targetId, returned);
      nextMeta = this.addCardToHand(nextMeta, playerId, returned);
      nextMeta = this.addCardToHand(nextMeta, targetId, giveCardId);
      next = this.setMeta(next, nextMeta);
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} ÃƒÆ’Ã‚Â©change ${this.getCardName(
          returned,
        )} avec ${resolvePlayerNameFromState(next, targetId)}.`,
      );
      return next;
    }

    nextMeta = this.addCardToHand(nextMeta, targetId, giveCardId);
    next = this.setMeta(next, nextMeta);
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} donne une carte ÃƒÆ’Ã‚Â  ${resolvePlayerNameFromState(
        next,
        targetId,
      )}.`,
    );
    return next;
  }

  private playGrimpeur(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    let next = state;
    let nextMeta = this.getMeta(next);
    for (let i = 0; i < 2; i += 1) {
      const { cardId, meta: updatedMeta } = this.drawForPlayer(
        nextMeta,
        playerId,
      );
      nextMeta = updatedMeta;
      next = this.setMeta(next, nextMeta);
      if (cardId) {
        next = this.core.appendLog(
          next,
          `${resolvePlayerNameFromState(next, playerId)} grimpe et pioche ${this.getCardName(cardId)}.`,
        );
      }
    }
    return next;
  }

  private addCardToTroop(
    state: GameStateEntity,
    playerId: number,
    cardId: string,
    species: string | null,
    isJoker: boolean,
  ): GameStateEntity {
    if (!species) return state;
    const meta = this.getMeta(state);
    const troops = { ...(meta.troops ?? {}) };
    const playerTroop = [...(troops[playerId] ?? [])];
    playerTroop.push({
      cardId,
      species,
      isJoker,
    } as BandeABananeTroopEntry);
    troops[playerId] = playerTroop;
    let next = this.setMeta(state, { ...meta, troops });
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} joue ${this.getCardName(cardId)} dans sa troupe.${
        isJoker ? ' (joker)' : ''
      }`,
    );

    if (this.hasWinningTroupe(this.getMeta(next), playerId)) {
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} crie ÃƒÆ’Ã‚Â  BANAAAANE ! ÃƒÆ’Ã‚Â  et devient le chef de la Bande ÃƒÆ’Ã‚Â  Banane !`,
      );
      next = {
        ...next,
        status: 'finished',
        metadata: {
          ...this.getMeta(next),
          winnerId: playerId,
        },
      };
    }

    return next;
  }

  private enforceHandLimit(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    let next = state;
    let nextMeta = this.getMeta(next);
    let hand = this.getPlayerHand(nextMeta, playerId);
    while (hand.length > BandeABananeActionService.HAND_LIMIT) {
      const { index, meta: updatedRng } = this.random.pickIndex(
        nextMeta.rng ?? {},
        hand.length,
      );
      const cardId = hand[index];
      nextMeta = { ...nextMeta, rng: updatedRng };
      nextMeta = this.removeCardFromHand(nextMeta, playerId, cardId);
      nextMeta = this.addCardToDiscard(nextMeta, cardId);
      next = this.setMeta(next, nextMeta);
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} dÃƒÆ’Ã‚Â©passe 7 cartes et dÃƒÆ’Ã‚Â©fausse ${this.getCardName(
          cardId,
        )}.`,
      );
      hand = this.getPlayerHand(nextMeta, playerId);
    }
    return next;
  }

  private addSkipTurns(
    state: GameStateEntity,
    playerId: number,
    amount: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const statuses = meta.statuses ?? { skipTurn: {} };
    const skipTurn = { ...(statuses.skipTurn ?? {}) };
    const current = skipTurn[playerId] ?? 0;
    skipTurn[playerId] = current + amount;
    const nextMeta = {
      ...meta,
      statuses: {
        ...statuses,
        skipTurn,
      },
    };
    return this.setMeta(state, nextMeta);
  }

  private discardRandomCard(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const hand = this.getPlayerHand(meta, playerId);
    if (!hand.length) return next;
    const { index, meta: updatedRng } = this.random.pickIndex(
      meta.rng ?? {},
      hand.length,
    );
    const cardId = hand[index];
    meta = { ...meta, rng: updatedRng };
    meta = this.removeCardFromHand(meta, playerId, cardId);
    meta = this.addCardToDiscard(meta, cardId);
    next = this.setMeta(next, meta);
    return next;
  }

  private drawForPlayer(
    meta: BandeABananeMetadata,
    playerId: number,
  ): { meta: BandeABananeMetadata; cardId: string | null } {
    const { cardId, meta: withCard } = this.drawOneCard(meta);
    if (!cardId) {
      return { meta: withCard, cardId: null };
    }
    const hands = { ...(withCard.hands ?? {}) };
    const playerHand = [...(hands[playerId] ?? [])];
    playerHand.push(cardId);
    hands[playerId] = playerHand;
    return { meta: { ...withCard, hands }, cardId };
  }

  private drawOneCard(meta: BandeABananeMetadata): {
    meta: BandeABananeMetadata;
    cardId: string | null;
  } {
    return drawOneBandeABananeCard(this.deckPolicies, meta);
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
        `${resolvePlayerNameFromState(next, playerId)} pioche ${this.getCardName(cardId)}.`,
      );
    }
    return next;
  }

  private clearDrawn(state: GameStateEntity): GameStateEntity {
    const meta = this.getMeta(state);
    return this.setMeta(state, { ...meta, drawnPlayerId: null });
  }

  private getMeta(state: GameStateEntity): BandeABananeMetadata {
    return (state.metadata ?? {}) as BandeABananeMetadata;
  }

  private setMeta(
    state: GameStateEntity,
    metadata: BandeABananeMetadata,
  ): GameStateEntity {
    return { ...state, metadata };
  }

  private playerHasCard(
    meta: BandeABananeMetadata,
    playerId: number,
    cardId: string,
  ): boolean {
    const hand = this.getPlayerHand(meta, playerId);
    return hand.includes(cardId);
  }

  private getPlayerHand(
    meta: BandeABananeMetadata,
    playerId: number,
  ): string[] {
    return getBandeABananePlayerHand(meta, playerId);
  }

  private addCardToHand(
    meta: BandeABananeMetadata,
    playerId: number,
    cardId: string,
  ): BandeABananeMetadata {
    return addBandeABananeCardToHand(meta, playerId, cardId);
  }

  private removeCardFromHand(
    meta: BandeABananeMetadata,
    playerId: number,
    cardId: string,
  ): BandeABananeMetadata {
    return removeBandeABananeCardFromHand(meta, playerId, cardId);
  }

  private addCardToDiscard(
    meta: BandeABananeMetadata,
    cardId: string,
  ): BandeABananeMetadata {
    return addBandeABananeCardToDiscard(meta, cardId);
  }

  private getCardName(cardId: string): string {
    return getBandeABananeCardName(cardId);
  }

  private hasWinningTroupe(
    meta: BandeABananeMetadata,
    playerId: number,
  ): boolean {
    const entries = Array.isArray(meta.troops?.[playerId])
      ? meta.troops[playerId]
      : [];
    const species = new Set(entries.map((entry) => entry.species));
    return species.size >= 5;
  }
}







