import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import type { GameStateWithActions } from '../../../../../core/application/models/game-action.model';
import { resolvePlayerName } from '../../../../../core/application/helpers/player-name.helper';

import { formatPresenterActions } from '../../../../../core/application/helpers/actions-presenter.helper';
import * as Rulebook from '../../rulebook/rulebook';
import { ABSURDISSIMES_GAME } from '../../definitions/game.definition';
import type { AbsurdissimesMetadata } from '../../model/les-absurdissimes-state.model';
import {
  buildLamaLikePanels,
  summarizeHandCounts,
} from '../../../../../core/application/helpers/lamalike-presenter.helper';
import { stringOrEmpty } from '@common/utils/public-api';

export class AbsurdissimesPresenterService {
  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const meta = (state.metadata ?? {}) as AbsurdissimesMetadata;
    const actions = Rulebook.getAvailableActions(state, userId);
    const judgeId = Rulebook.getJudgeId(state, meta);
    const hand = meta.blackHands?.[userId] ?? [];
    const handCounts = summarizeHandCounts(meta.blackHands);
    const panels = buildLamaLikePanels({
      hand,
      handCounts,
      discardLabel: 'Défausse du juge',
      scoreLines: Object.entries(meta.scores ?? {}).map(
        ([playerId, score]) => `Joueur ${playerId}: ${score ?? 0}`,
      ),
      tableMessage: `Phase : ${meta.roundStage ?? 'en attente'}`,
    });

    return {
      ...state,
      catalog: {
        phases: ABSURDISSIMES_GAME.phaseOrder.map((phase) => phase.id),
        victory: null,
      },
      actions: formatPresenterActions(actions, (action) =>
        this.buildLabel(action, state),
      ),
      extras: {
        stage: meta.roundStage,
        currentWhite: meta.currentWhite ?? null,
        judgeId,
        hand,
        remainingPlayers: meta.remainingPlayers ?? [],
        scores: meta.scores,
        targetScore: meta.targetScore,
        submissions: meta.submissions,
        winnerId: meta.winnerId ?? null,
        ui: { panels },
      },
      pending: state.pending ?? null,
    };
  }

  private buildLabel(
    action: { type: string; payload?: Record<string, unknown> },
    state: GameStateEntity,
  ): string {
    if (action.type === 'play_card') {
      const cardId = stringOrEmpty(action.payload?.cardId);
      return cardId ? `Jouer ${cardId}` : 'Jouer une carte';
    }
    if (action.type === 'judge_pick') {
      const winnerId = Number(action.payload?.winnerId ?? 0);
      return `Choisir ${resolvePlayerName(state.players, winnerId)}`;
    }
    return action.type;
  }
}



