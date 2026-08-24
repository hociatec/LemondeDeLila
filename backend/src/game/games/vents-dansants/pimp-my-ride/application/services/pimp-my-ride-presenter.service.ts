import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type { GameStateWithActions } from '../../../../../application/models/game-action.model';

import { formatPresenterActions } from '../../../../../application/helpers/actions-presenter.helper';
import * as Rulebook from '../../rulebook/rulebook';
import { PIMP_MY_RIDE_GAME } from '../../definitions/game.definition';
import type { PimpMyRideMetadata } from '../../model/pimp-my-ride-state.model';
import {
  buildLamaLikePanels,
  summarizeHandCounts,
} from '../../../../../application/helpers/lamalike-presenter.helper';

export class PimpMyRidePresenterService {
  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const meta = (state.metadata ?? {}) as PimpMyRideMetadata;
    const actions = Rulebook.getAvailableActions(state, userId);
    const hand = Array.isArray(meta.hands?.[userId])
      ? [...meta.hands[userId]]
      : [];
    const handCounts = summarizeHandCounts(meta.hands);
    const panels = buildLamaLikePanels({
      hand,
      handCounts,
      discardLabel: 'Garage',
      tableMessage: `Statut: ${state.status ?? 'en attente'}`,
    });

    return {
      ...state,
      catalog: {
        phases: PIMP_MY_RIDE_GAME.phaseOrder.map((phase) => phase.id),
        victory: null,
      },
      actions: formatPresenterActions(actions),
      extras: {
        hand,
        hands: meta.hands,
        progress: meta.progress,
        deckCount: meta.deck?.length ?? 0,
        drawnPlayerId: meta.drawnPlayerId ?? null,
        carNameIndex: meta.carNameIndex,
        ui: { panels },
      },
      pending: state.pending ?? null,
    };
  }
}



