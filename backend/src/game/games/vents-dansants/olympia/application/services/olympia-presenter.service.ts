import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type { GameStateWithActions } from '../../../../../application/models/game-action.model';

import { formatPresenterActions } from '../../../../../application/helpers/actions-presenter.helper';
import * as Rulebook from '../../rulebook/rulebook';
import { OLYMPIA_GAME } from '../../definitions/game.definition';
import type { OlympiaMetadata } from '../../model/olympia-state.model';
import {
  buildLamaLikePanels,
  summarizeHandCounts,
} from '../../../../../application/helpers/lamalike-presenter.helper';

export class OlympiaPresenterService {
  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const meta = (state.metadata ?? {}) as OlympiaMetadata;
    const actions = Rulebook.getAvailableActions(state, userId);
    const deckCounts = this.buildDeckCounts(meta);
    const hand = Array.isArray(meta.hands?.[userId])
      ? [...meta.hands[userId]]
      : [];
    const handCounts = summarizeHandCounts(meta.hands);
    const panels = buildLamaLikePanels({
      hand,
      handCounts,
      discardLabel: 'Divinités',
      tableMessage: `Statut: ${state.status ?? 'en attente'}`,
    });
    return {
      ...state,
      catalog: {
        phases: OLYMPIA_GAME.phaseOrder.map((phase) => phase.id),
        victory: null,
      },
      actions: formatPresenterActions(actions),
      extras: {
        hand,
        hands: meta.hands,
        prestige: meta.prestige,
        divinity: meta.divinity,
        decks: deckCounts,
        statuses: meta.statuses,
        ui: { panels },
      },
      pending: state.pending ?? null,
    };
  }

  private buildDeckCounts(meta: OlympiaMetadata): Record<string, number> {
    const decks = meta.decks ?? {};
    const counts: Record<string, number> = {};
    for (const [deck, cards] of Object.entries(decks)) {
      counts[deck] = Array.isArray(cards) ? cards.length : 0;
    }
    return counts;
  }
}


