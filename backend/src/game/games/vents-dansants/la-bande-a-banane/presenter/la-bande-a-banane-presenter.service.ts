import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import * as Rulebook from '../rulebook/rulebook';
import { BANDE_A_BANANE_GAME } from '../definitions/game.definition';
import type { BandeABananeMetadata } from '../model/la-bande-a-banane-state.entity';

@Injectable()
export class BandeABananePresenterService {
  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const meta = (state.metadata ?? {}) as BandeABananeMetadata;
    const actions = Rulebook.getAvailableActions(state, userId);
    return {
      ...state,
      catalog: {
        phases: BANDE_A_BANANE_GAME.phaseOrder.map((phase) => phase.id),
        victory: null,
      },
      actions: actions.map((action) => ({
        type: action.type,
        label: action.type,
        payload: action.payload ?? {},
      })),
      extras: {
        hands: meta.hands,
        troops: meta.troops,
        statuses: meta.statuses,
      },
      pending: state.pending ?? null,
    } as any;
  }
}
