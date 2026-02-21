import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';

import { formatPresenterActions } from '../../../../presenters/actions-presenter.helper';
import * as Rulebook from '../rulebook/rulebook';
import { LA_PARADE_SEQUENCE } from '../model/la-parade-sucree-cards';
import type { LaParadeSucreeMetadata } from '../model/la-parade-sucree-state.entity';
import {
  buildLamaLikePanels,
  summarizeHandCounts,
} from '../../../../presenters/lamalike-presenter.helper';

@Injectable()
export class LaParadeSucreePresenterService {
  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const meta = (state.metadata ?? {}) as LaParadeSucreeMetadata;
    const actions = Rulebook.getAvailableActions(state, userId);
    const hand = Array.isArray(meta.hands?.[userId])
      ? [...meta.hands[userId]]
      : [];
    const handCounts = summarizeHandCounts(meta.hands);
    const panels = buildLamaLikePanels({
      hand,
      handCounts,
      discardLabel: 'Bonbons joués',
      tableMessage: `Statut: ${state.status ?? 'en attente'}`,
    });
    const nextValue = LA_PARADE_SEQUENCE[meta.sequenceIndex];
    return {
      ...state,
      catalog: {
        phases: ['round'],
        victory: null,
      },
      actions: formatPresenterActions(actions),
      extras: {
        hand,
        hands: meta.hands,
        candies: meta.candies,
        nextCard: nextValue,
        played: meta.played,
        ui: { panels },
      },
      pending: state.pending ?? null,
    } as any;
  }
}
