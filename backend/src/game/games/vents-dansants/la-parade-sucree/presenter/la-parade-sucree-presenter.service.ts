import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import * as Rulebook from '../rulebook/rulebook';
import { LA_PARADE_SEQUENCE } from '../model/la-parade-sucree-cards';
import type { LaParadeSucreeMetadata } from '../model/la-parade-sucree-state.entity';

@Injectable()
export class LaParadeSucreePresenterService {
  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const meta = (state.metadata ?? {}) as LaParadeSucreeMetadata;
    const actions = Rulebook.getAvailableActions(state, userId);
    const hand = Array.isArray(meta.hands?.[userId]) ? [...meta.hands[userId]] : [];
    const nextValue = LA_PARADE_SEQUENCE[meta.sequenceIndex];
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
        hand,
        hands: meta.hands,
        candies: meta.candies,
        nextCard: nextValue,
        played: meta.played,
      },
      pending: state.pending ?? null,
    } as any;
  }
}
