import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import * as Rulebook from '../rulebook/rulebook';
import { LES_MAINS_CARD_BY_ID } from '../model/les-mains-de-la-terre-cards';
import { LES_MAINS_GAME } from '../definitions/game.definition';
import type { LesMainsMetadata } from '../model/les-mains-de-la-terre-state.entity';

@Injectable()
export class LesMainsPresenterService {
  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const meta = (state.metadata ?? {}) as LesMainsMetadata;
    const actions = Rulebook.getAvailableActions(state, userId);
    const hand = Array.isArray(meta.hands?.[userId]) ? meta.hands[userId] : [];

    return {
      ...state,
      catalog: {
        phases: LES_MAINS_GAME.phaseOrder.map((phase) => phase.id),
        victory: null,
      },
      actions: actions.map((action) => ({
        type: action.type,
        label: this.buildLabel(action),
        payload: action.payload ?? {},
      })),
      extras: {
        hand,
        deckCount: meta.deck?.length ?? 0,
        completedFamilies: meta.completedFamilies,
        freeRequest: Boolean(meta.freeFamilyRequest?.[userId]),
        statuses: meta.statuses,
      },
      pending: state.pending ?? null,
    } as any;
  }

  private buildLabel(action: { type: string; payload?: Record<string, unknown> }): string {
    if (action.type === 'request_card') {
      const cardId = String(action.payload?.cardId ?? '');
      return `Demander ${LES_MAINS_CARD_BY_ID[cardId]?.name ?? cardId}`;
    }
    return action.type;
  }
}
