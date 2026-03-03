import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';

import { formatPresenterActions } from '../../../../presenters/actions-presenter.helper';
import * as Rulebook from '../rulebook/rulebook';
import type { LaGrandeMineMetadata } from '../model/la-grande-mine-state.entity';
import {
  buildLamaLikePanels,
  summarizeHandCounts,
} from '../../../../presenters/lamalike-presenter.helper';

@Injectable()
export class LaGrandeMineDeBarbakPresenterService {
  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const meta = this.getMeta(state);
    const hands =
      meta.hands && typeof meta.hands === 'object' ? meta.hands : {};
    const deck = Array.isArray(meta.deck) ? meta.deck : [];
    const discard = Array.isArray(meta.discard) ? meta.discard : [];
    const actions = Rulebook.getAvailableActions(state, userId);
    const hand = Array.isArray(hands?.[userId]) ? [...hands[userId]] : [];
    const handCounts = summarizeHandCounts(hands);
    const panels = buildLamaLikePanels({
      hand,
      handCounts,
      discardLabel: 'Puits',
      tableMessage: `Statut: ${state.status ?? 'en attente'}`,
    });
    return {
      ...state,
      catalog: {
        phases: ['round'],
        victory: null,
      },
      actions: formatPresenterActions(actions),
      extras: {
        hand,
        hands,
        domains: meta.domains,
        deckCount: deck.length,
        discardCount: discard.length,
        drawnPlayerId: meta.drawnPlayerId,
        winnerId: meta.winnerId ?? null,
        ui: { panels },
      },
      pending: state.pending ?? null,
    } as any;
  }

  private getMeta(state: GameStateEntity): LaGrandeMineMetadata {
    return (state.metadata ?? {}) as LaGrandeMineMetadata;
  }
}
