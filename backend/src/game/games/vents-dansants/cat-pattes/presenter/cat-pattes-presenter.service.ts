import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import * as Rulebook from '../rulebook/rulebook';
import { CAT_PATTES_GAME } from '../definitions/game.definition';
import type { CatPattesMetadata } from '../model/cat-pattes-state.entity';
import {
  buildLamaLikePanels,
  summarizeHandCounts,
} from '../../../../presenters/lamalike-presenter.helper';

@Injectable()
export class CatPattesPresenterService {
  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const meta = (state.metadata ?? {}) as CatPattesMetadata;
    const actions = Rulebook.getAvailableActions(state, userId);
    const hand = Array.isArray(meta.hands?.[userId]) ? [...meta.hands[userId]] : [];
    const handCounts = summarizeHandCounts(meta.hands);
    const panels = buildLamaLikePanels({
      hand,
      handCounts,
      discardLabel: 'Table de jeu',
      scoreLines: Object.entries(meta.positions ?? {}).map(
        ([playerId, value]) => `Joueur ${playerId}: ${value ?? 0} pattes`,
      ),
      tableMessage: `Statut: ${state.status ?? 'en attente'}`,
    });
    const extras = {
      hand,
      hands: meta.hands,
      positions: meta.positions,
      obstacles: meta.obstacles,
      bots: meta.bots,
      hasSun: meta.hasSun,
      ui: { panels },
    };

    return {
      ...state,
      catalog: {
        phases: CAT_PATTES_GAME.phaseOrder.map((phase) => phase.id),
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
