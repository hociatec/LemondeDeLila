import type { GameStateEntity } from '../../../../application/models/game-state.model';
import type { GameSingleActionDto } from '../../../../models/game-action.model';
import { resolvePlayerNameFromState } from '../../../../application/helpers/player-name.helper';

import { GameCoreService } from '../../../../application/services/game-core.service';
import { TurnFlowService } from '../../../../application/services/turn-flow.service';
import { DeckPoliciesService } from '../../../../application/features/deck-policies/services/deck-policies.service';
import {
  PIMP_MY_RIDE_CARD_BY_ID,
  PIMP_MY_RIDE_CAR_NAMES,
  PIMP_MY_RIDE_CATEGORY_ORDER,
} from '../../model/pimp-my-ride-cards';
import {
  applyActionsSequentially,
  dispatchByActionType,
  normalizeActionType,
} from '../../../../application/helpers/action-service.helper';
import type {
  PimpMyRideCompletedCar,
  PimpMyRideMetadata,
  PimpMyRidePlayerProgress,
} from '../../model/pimp-my-ride-state.model';
import {
  addPimpMyRideCardToDiscardMeta,
  addPimpMyRideCardToHandMeta,
  drawOnePimpMyRideCard,
  removePimpMyRideCardFromHandMeta,
} from './pimp-my-ride-action.utils';

export class PimpMyRideActionPayload {
  cardId?: string | null;
}

const CATEGORY_LABELS: Record<
  (typeof PIMP_MY_RIDE_CATEGORY_ORDER)[number],
  string
> = {
  carrosserie: 'la carrosserie',
  roues: 'les roues',
  moteur: 'le moteur',
  volant: 'le volant',
  sieges: 'les siÃƒÆ’Ã‚Â¨ges',
  phares: 'les phares',
  accessoires: 'les accessoires',
};

export class PimpMyRideActionService {
  constructor(
    private readonly core: GameCoreService,
    private readonly turns: TurnFlowService,
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
          play_card: () => {
            next = this.handlePlayCard(next, action);
            return next;
          },
          discard_card: () => {
            next = this.handleDiscardCard(next, action);
            return next;
          },
          pass: () => {
            next = this.handlePass(next);
            return next;
          },
        },
        () => next,
      );
    });
    return next;
  }

  private handlePass(state: GameStateEntity): GameStateEntity {
    const playerId = state.turn?.currentPlayerId ?? null;
    if (playerId == null) return state;

    let next = this.ensurePlayerDrawn(state, playerId);
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} garde sa carte et passe son tour.`,
    );
    next = this.turns.advanceTurn(next);
    return this.clearDrawn(next);
  }

  private handlePlayCard(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const playerId = state.turn?.currentPlayerId ?? null;
    if (playerId == null) return state;

    let next = this.ensurePlayerDrawn(state, playerId);
    const payload = (action.payload ?? {}) as PimpMyRideActionPayload;
    const cardId = String(payload.cardId ?? '').trim();
    if (!cardId) return next;

    const definition = PIMP_MY_RIDE_CARD_BY_ID[cardId];
    if (!definition) return next;

    const meta = this.getMeta(next);
    if (!this.playerHasCard(meta, playerId, cardId)) return next;

    let updatedMeta = this.removeCardFromHand(meta, playerId, cardId);
    let progress = this.getProgress(updatedMeta, playerId);
    progress = {
      ...progress,
      stageIndex: progress.stageIndex + 1,
      carParts: [...progress.carParts, cardId],
    };
    updatedMeta = this.setProgress(updatedMeta, playerId, progress);

    next = this.setMeta(next, updatedMeta);

    const category = definition.category;
    const label = CATEGORY_LABELS[category] ?? category;
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} pose ${definition.name} pour ${label}.`,
    );

    if (progress.stageIndex >= PIMP_MY_RIDE_CATEGORY_ORDER.length) {
      next = this.completeCar(next, playerId);
      progress = this.getProgress(this.getMeta(next), playerId);
    }

    if ((this.getMeta(next).winnerId ?? null) != null) {
      return this.clearDrawn(next);
    }

    next = this.turns.advanceTurn(next);
    return this.clearDrawn(next);
  }

  private handleDiscardCard(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const playerId = state.turn?.currentPlayerId ?? null;
    if (playerId == null) return state;

    let next = this.ensurePlayerDrawn(state, playerId);
    const payload = (action.payload ?? {}) as PimpMyRideActionPayload;
    const cardId = String(payload.cardId ?? '').trim();
    if (!cardId) return next;

    const meta = this.getMeta(next);
    if (!this.playerHasCard(meta, playerId, cardId)) return next;

    let updatedMeta = this.removeCardFromHand(meta, playerId, cardId);
    updatedMeta = this.addCardToDiscard(updatedMeta, cardId);
    next = this.setMeta(next, updatedMeta);
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} jette ${this.getCardName(cardId)} ÃƒÆ’Ã‚Â  la dÃƒÆ’Ã‚Â©fausse.`,
    );

    next = this.turns.advanceTurn(next);
    return this.clearDrawn(next);
  }

  private completeCar(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    let next = state;
    const meta = this.getMeta(next);
    const progress = this.getProgress(meta, playerId);
    const carParts = [...progress.carParts];
    const carNameEntry =
      PIMP_MY_RIDE_CAR_NAMES[meta.carNameIndex % PIMP_MY_RIDE_CAR_NAMES.length];
    const completedCar: PimpMyRideCompletedCar = {
      name: carNameEntry.name,
      description: carNameEntry.description,
      parts: carParts,
    };
    const updatedProgress = {
      ...progress,
      stageIndex: 0,
      carParts: [],
      completedCars: [...progress.completedCars, completedCar],
    };
    const nextMeta = {
      ...meta,
      progress: {
        ...meta.progress,
        [playerId]: updatedProgress,
      },
      carNameIndex: (meta.carNameIndex + 1) % PIMP_MY_RIDE_CAR_NAMES.length,
    };
    next = this.setMeta(next, nextMeta);
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} termine la voiture ${carNameEntry.name} (${carNameEntry.description}).`,
    );

    if (updatedProgress.completedCars.length >= 3) {
      next = {
        ...next,
        status: 'finished',
        metadata: { ...this.getMeta(next), winnerId: playerId },
      };
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} remporte la partie en terminant trois voitures !`,
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
    const { cardId, meta: updatedMeta } = this.drawOneCard(meta);
    let next = this.setMeta(state, {
      ...updatedMeta,
      drawnPlayerId: playerId,
      drawnCardId: cardId,
    });
    if (cardId) {
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} pioche ${this.getCardName(cardId)}.`,
      );
      next = this.addCardToHand(next, playerId, cardId);
    } else {
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} ne trouve plus de cartes ÃƒÆ’Ã‚Â  piocher.`,
      );
    }
    return next;
  }

  private drawOneCard(meta: PimpMyRideMetadata): {
    cardId: string | null;
    meta: PimpMyRideMetadata;
  } {
    return drawOnePimpMyRideCard(this.deckPolicies, meta);
  }

  private addCardToHand(
    state: GameStateEntity,
    playerId: number,
    cardId: string,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    return this.setMeta(state, addPimpMyRideCardToHandMeta(meta, playerId, cardId));
  }

  private removeCardFromHand(
    meta: PimpMyRideMetadata,
    playerId: number,
    cardId: string,
  ): PimpMyRideMetadata {
    return removePimpMyRideCardFromHandMeta(meta, playerId, cardId);
  }

  private addCardToDiscard(
    meta: PimpMyRideMetadata,
    cardId: string,
  ): PimpMyRideMetadata {
    return addPimpMyRideCardToDiscardMeta(meta, cardId);
  }

  private setProgress(
    meta: PimpMyRideMetadata,
    playerId: number,
    progress: PimpMyRidePlayerProgress,
  ): PimpMyRideMetadata {
    return {
      ...meta,
      progress: { ...meta.progress, [playerId]: progress },
    };
  }

  private getProgress(
    meta: PimpMyRideMetadata,
    playerId: number,
  ): PimpMyRidePlayerProgress {
    return (
      meta.progress?.[playerId] ?? {
        stageIndex: 0,
        carParts: [],
        completedCars: [],
      }
    );
  }

  private setMeta(
    state: GameStateEntity,
    metadata: PimpMyRideMetadata,
  ): GameStateEntity {
    return { ...state, metadata };
  }

  private getMeta(state: GameStateEntity): PimpMyRideMetadata {
    return (state.metadata ?? {}) as PimpMyRideMetadata;
  }

  private playerHasCard(
    meta: PimpMyRideMetadata,
    playerId: number,
    cardId: string,
  ): boolean {
    return (
      Array.isArray(meta.hands?.[playerId]) &&
      meta.hands[playerId].includes(cardId)
    );
  }

  private getCardName(cardId: string): string {
    return PIMP_MY_RIDE_CARD_BY_ID[cardId]?.name ?? cardId;
  }

  private clearDrawn(state: GameStateEntity): GameStateEntity {
    const meta = this.getMeta(state);
    return this.setMeta(state, {
      ...meta,
      drawnPlayerId: null,
      drawnCardId: null,
    });
  }
}






