import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import * as Rulebook from '../rulebook/rulebook';
import { CERCLES_SACRES_GAME } from '../definitions/game.definition';
import type { CerclesSacresMetadata } from '../model/cercles-sacres-state.entity';

@Injectable()
export class CerclesSacresPresenterService {
  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const meta = (state.metadata ?? {}) as CerclesSacresMetadata;
    const actions = Rulebook.getAvailableActions(state, userId);
    const hand = Array.isArray(meta.hands?.[userId]) ? [...meta.hands[userId]] : [];
    const extras = {
      hand,
      hands: meta.hands,
      circles: meta.circles,
      deckCount: meta.deck.length,
      discardCount: meta.discard.length,
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
