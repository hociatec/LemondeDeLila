import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type { GameStateWithActions } from '../../../../../application/models/game-action.model';

import { formatPresenterActions } from '../../../../../application/helpers/actions-presenter.helper';
import * as Rulebook from '../../rulebook/rulebook';
import { BANDE_A_BANANE_GAME } from '../../definitions/game.definition';
import type { BandeABananeMetadata } from '../../model/la-bande-a-banane-state.model';
import {
  buildLamaLikePanels,
  summarizeHandCounts,
} from '../../../../../application/helpers/lamalike-presenter.helper';

export class BandeABananePresenterService {
  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const meta = (state.metadata ?? {}) as BandeABananeMetadata;
    const actions = Rulebook.getAvailableActions(state, userId);
    const hand = Array.isArray(meta.hands?.[userId])
      ? [...meta.hands[userId]]
      : [];
    const handCounts = summarizeHandCounts(meta.hands);
    const panels = buildLamaLikePanels({
      hand,
      handCounts,
      discardLabel: 'Troops en jeu',
      tableMessage: `Statut: ${state.status ?? 'en attente'}`,
    });
    return {
      ...state,
      catalog: {
        phases: BANDE_A_BANANE_GAME.phaseOrder.map((phase) => phase.id),
        victory: null,
      },
      actions: formatPresenterActions(actions),
      extras: {
        hand,
        hands: meta.hands,
        troops: meta.troops,
        statuses: meta.statuses,
        ui: { panels },
      },
      pending: state.pending ?? null,
    };
  }
}



