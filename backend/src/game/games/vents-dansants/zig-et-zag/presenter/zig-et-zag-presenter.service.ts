import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import * as Rulebook from '../rulebook/rulebook';
import { ZIG_ET_ZAG_GAME } from '../definitions/game.definition';
import type { ZigEtZagMetadata } from '../model/zig-et-zag-state.entity';
import {
  buildLamaLikePanels,
  summarizeHandCounts,
} from '../../../../presenters/lamalike-presenter.helper';

@Injectable()
export class ZigEtZagPresenterService {
  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const meta = (state.metadata ?? {}) as ZigEtZagMetadata;
    const actions = Rulebook.getAvailableActions(state, userId);
    const deckCounts: Record<number, number> = {};
    const decks = meta.playerDecks ?? {};
    const hand = Array.isArray(decks[String(userId)]) ? [...decks[String(userId)]] : [];
    const handCounts = summarizeHandCounts(decks);
    const panels = buildLamaLikePanels({
      hand,
      handCounts,
      discardLabel: 'Paquet',
      tableMessage: `Statut: ${state.status ?? 'en attente'}`,
    });
    Object.entries(decks).forEach(([key, cards]) => {
      const pid = Number(key);
      deckCounts[pid] = Array.isArray(cards) ? cards.length : 0;
    });

    return {
      ...state,
      catalog: {
        phases: ZIG_ET_ZAG_GAME.phaseOrder.map((phase) => phase.id),
        victory: null,
      },
      actions: actions.map((action) => ({
        type: action.type,
        label: 'Jouer une manche',
        payload: action.payload ?? {},
      })),
      extras: {
        hand,
        deckCounts,
        lastRound: meta.lastRound ?? null,
        ui: { panels },
      },
      pending: state.pending ?? null,
    } as any;
  }
}
