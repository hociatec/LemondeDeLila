import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import * as Rulebook from '../rulebook/rulebook';
import { OLYMPIA_GAME } from '../definitions/game.definition';
import type { OlympiaMetadata } from '../model/olympia-state.entity';
import {
  buildLamaLikePanels,
  summarizeHandCounts,
} from '../../../../presenters/lamalike-presenter.helper';

@Injectable()
export class OlympiaPresenterService {
  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const meta = (state.metadata ?? {}) as OlympiaMetadata;
    const actions = Rulebook.getAvailableActions(state, userId);
    const deckCounts = this.buildDeckCounts(meta);
    const hand = Array.isArray(meta.hands?.[userId]) ? [...meta.hands[userId]] : [];
    const handCounts = summarizeHandCounts(meta.hands);
    const panels = buildLamaLikePanels({
      hand,
      handCounts,
      discardLabel: 'Divinités',
      tableMessage: `Statut: ${state.status ?? 'en attente'}`,
    });
    return {
      ...state,
      catalog: {
        phases: OLYMPIA_GAME.phaseOrder.map((phase) => phase.id),
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
        prestige: meta.prestige,
        divinity: meta.divinity,
        decks: deckCounts,
        statuses: meta.statuses,
        ui: { panels },
      },
      pending: state.pending ?? null,
    } as any;
  }

  private buildDeckCounts(meta: OlympiaMetadata): Record<string, number> {
    const decks = meta.decks ?? {};
    const counts: Record<string, number> = {};
    for (const [deck, cards] of Object.entries(decks)) {
      counts[deck] = Array.isArray(cards) ? cards.length : 0;
    }
    return counts;
  }
}
