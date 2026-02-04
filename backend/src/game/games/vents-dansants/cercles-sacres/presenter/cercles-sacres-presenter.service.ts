import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
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
    const actions = Rulebook.getAvailableActions(state, userId);
    const hand = Array.isArray(meta.hands?.[userId]) ? [...meta.hands[userId]] : [];
    const handCounts = summarizeHandCounts(meta.hands);
    const panels = buildLamaLikePanels({
      hand,
      handCounts,
      discardLabel: 'Défausse',
      tableMessage: `Ronde: ${state.status ?? 'en attente'}`,
    });
    const extras = {
      hand,
      hands: meta.hands,
      circles: meta.circles,
      deckCount: meta.deck.length,
      discardCount: meta.discard.length,
      ui: { panels },
    };

    return {
      ...state,
      catalog: {
        phases: CERCLES_SACRES_GAME.phaseOrder.map((phase) => phase.id),
        victory: null,
      },
      actions: actions.map((action) => ({
        type: action.type,
        label: action.type,
        payload: action.payload ?? {},
      })),
      extras,
      pending: state.pending ?? null,
    } as any;
  }
}
