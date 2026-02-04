import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import * as Rulebook from '../rulebook/rulebook';
import type { LaGrandeMineMetadata } from '../model/la-grande-mine-state.entity';

@Injectable()
export class LaGrandeMineDeBarbakPresenterService {
  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const meta = this.getMeta(state);
    const actions = Rulebook.getAvailableActions(state, userId);
    return {
      ...state,
      catalog: {
        phases: ['round'],
        victory: null,
      },
      actions: actions.map((action) => ({
        type: action.type,
        label: action.type,
        payload: action.payload ?? {},
      })),
      extras: {
        hands: meta.hands,
        domains: meta.domains,
        deckCount: meta.deck.length,
        discardCount: meta.discard.length,
        drawnPlayerId: meta.drawnPlayerId,
        winnerId: meta.winnerId ?? null,
      },
      pending: state.pending ?? null,
    } as any;
  }

  private getMeta(state: GameStateEntity): LaGrandeMineMetadata {
    return (state.metadata ?? {}) as LaGrandeMineMetadata;
  }
}
