import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import * as Rulebook from '../rulebook/rulebook';
import { DAME_NATURE_GAME } from '../definitions/game.definition';
import type { DameNatureMetadata } from '../model/dame-nature-state.entity';

@Injectable()
export class DameNaturePresenterService {
  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const meta = (state.metadata ?? {}) as DameNatureMetadata;
    const actions = Rulebook.getAvailableActions(state, userId);
    const deckCount = Array.isArray(meta.deck) ? meta.deck.length : 0;
    const pollution = meta.pollutionTokens ?? 0;

    return {
      ...state,
      catalog: {
        phases: DAME_NATURE_GAME.phaseOrder.map((phase) => phase.id),
        victory: null,
      },
      actions: actions.map((action) => ({
        type: action.type,
        label: action.type,
        payload: action.payload ?? {},
      })),
      extras: {
        hands: meta.hands,
        families: meta.families,
        pollutionTokens: pollution,
        deckCount,
        lastQuizCardId: meta.lastQuizCardId ?? null,
        pollutionLoserId: meta.pollutionLoserId ?? null,
      },
      pending: state.pending ?? null,
    } as any;
  }
}
