import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';

import { formatPresenterActions } from '../../../../presenters/actions-presenter.helper';
import * as Rulebook from '../rulebook/rulebook';
import { CERCLES_SACRES_GAME } from '../definitions/game.definition';
import type { CerclesSacresMetadata } from '../model/cercles-sacres-state.entity';
import {
  buildLamaLikePanels,
  summarizeHandCounts,
} from '../../../../presenters/lamalike-presenter.helper';

@Injectable()
export class CerclesSacresPresenterService {
  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const meta = (state.metadata ?? {}) as CerclesSacresMetadata;
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
      discardLabel: 'Défausse',
      tableMessage: `Ronde: ${state.status ?? 'en attente'}`,
    });
    const extras = {
      hand,
      hands,
      circles: meta.circles,
      deckCount: deck.length,
      discardCount: discard.length,
      ui: { panels },
    };

    return {
      ...state,
      catalog: {
        phases: CERCLES_SACRES_GAME.phaseOrder.map((phase) => phase.id),
        victory: null,
      },
      actions: formatPresenterActions(actions),
      extras,
      pending: state.pending ?? null,
    } as any;
  }
}
