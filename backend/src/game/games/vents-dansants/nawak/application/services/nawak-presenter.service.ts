import type { GameStateEntity } from '../../../../application/models/game-state.model';
import type { GameStateWithActions } from '../../../../models/game-action.model';
import { resolvePlayerName } from '../../../../application/helpers/player-name.helper';

import { formatPresenterActions } from '../../../../application/helpers/actions-presenter.helper';
import * as Rulebook from '../../rulebook/rulebook';
import { NAWAK_GAME } from '../../definitions/game.definition';
import type { NawakMetadata } from '../../model/nawak-state.model';
import { buildLamaLikePanels } from '../../../../application/helpers/lamalike-presenter.helper';

export class NawakPresenterService {
  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const meta = (state.metadata ?? {}) as NawakMetadata;
    const actions = Rulebook.getAvailableActions(state, userId);
    const hand = Array.isArray(meta.currentChallenge?.answers)
      ? meta.currentChallenge.answers
      : [];
    const panels = buildLamaLikePanels({
      hand,
      discardLabel: 'DÃƒÆ’Ã‚Â©fis disponibles',
      scoreLines: Object.entries(meta.scores ?? {}).map(
        ([playerId, value]) => `Joueur ${playerId}: ${value ?? 0}`,
      ),
      tableMessage: `Phase : ${meta.roundStage ?? 'en attente'}`,
    });

    return {
      ...state,
      catalog: {
        phases: NAWAK_GAME.phaseOrder.map((phase) => phase.id),
        victory: null,
      },
      actions: formatPresenterActions(actions, (action) =>
        this.buildLabel(action, meta, state),
      ),
      extras: {
        hand,
        targetScore: meta.targetScore,
        scores: meta.scores,
        stage: meta.roundStage,
        challenge: meta.currentChallenge,
        submissions: meta.submissions,
        votes: meta.votes,
        lastRound: meta.lastRound ?? null,
        ui: { panels },
      },
      pending: state.pending ?? null,
    };
  }

  private buildLabel(
    action: { type: string; payload?: Record<string, unknown> },
    meta: NawakMetadata,
    state: GameStateEntity,
  ): string {
    if (action.type === 'choose_answer') {
      const index = Number(action.payload?.answerIndex ?? 0);
      const raw =
        meta.currentChallenge.answers?.[index] ?? `rÃƒÆ’Ã‚Â©ponse ${index + 1}`;
      const answer = String(raw)
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
      return `Choisir Ãƒâ€šÃ‚Â«${answer.length > 0 ? answer : `rÃƒÆ’Ã‚Â©ponse ${index + 1}`}Ãƒâ€šÃ‚Â»`;
    }
    if (action.type === 'vote_answer') {
      const target = Number(action.payload?.targetPlayerId ?? 0);
      return `Voter pour ${resolvePlayerName(state.players, target)}`;
    }
    return action.type;
  }
}



