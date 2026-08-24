import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type { GameStateWithActions } from '../../../../../application/models/game-action.model';

import { formatPresenterActions } from '../../../../../application/helpers/actions-presenter.helper';
import * as Rulebook from '../../rulebook/rulebook';
import type { LaGrandeMineMetadata } from '../../model/la-grande-mine-state.model';
import {
  buildLamaLikePanels,
  summarizeHandCounts,
} from '../../../../../application/helpers/lamalike-presenter.helper';

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
    };
  }

  private getMeta(state: GameStateEntity): LaGrandeMineMetadata {
    return (state.metadata ?? {}) as LaGrandeMineMetadata;
  }
}



