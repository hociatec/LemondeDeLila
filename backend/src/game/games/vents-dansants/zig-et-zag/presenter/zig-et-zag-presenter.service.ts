import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import * as Rulebook from '../rulebook/rulebook';
import { ZIG_ET_ZAG_GAME } from '../definitions/game.definition';
import type { ZigEtZagMetadata } from '../model/zig-et-zag-state.entity';

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
        deckCounts,
        lastRound: meta.lastRound ?? null,
      },
      pending: state.pending ?? null,
    } as any;
  }
}
