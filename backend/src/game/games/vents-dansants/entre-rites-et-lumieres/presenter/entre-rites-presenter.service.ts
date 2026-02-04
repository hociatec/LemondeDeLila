import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import * as Rulebook from '../rulebook/rulebook';
import { ENTRE_RITES_GAME } from '../definitions/game.definition';
import type { EntreRitesMetadata } from '../model/entre-rites-state.entity';

@Injectable()
export class EntreRitesPresenterService {
  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const meta = (state.metadata ?? {}) as EntreRitesMetadata;
    const actions = Rulebook.getAvailableActions(state, userId);
    const extras = {
      hand: meta.hands?.[userId] ?? [],
      familyCollections: meta.familyCollections,
      completedFamilies: meta.completedFamilies,
      specialsPlayed: meta.specialsPlayed,
      specialsPlayedCount: meta.specialsPlayedCount,
      deckCount: meta.deck.length,
      discardCount: meta.discard.length,
    };

    return {
      ...state,
      catalog: {
        phases: ENTRE_RITES_GAME.phaseOrder.map((phase) => phase.id),
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
