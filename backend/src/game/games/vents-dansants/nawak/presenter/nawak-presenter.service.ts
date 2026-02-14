import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';

import { formatPresenterActions } from '../../../../presenters/actions-presenter.helper';
import * as Rulebook from '../rulebook/rulebook';
import { NAWAK_GAME } from '../definitions/game.definition';
import type { NawakMetadata } from '../model/nawak-state.entity';
import { buildLamaLikePanels } from '../../../../presenters/lamalike-presenter.helper';

@Injectable()
export class NawakPresenterService {
  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const meta = (state.metadata ?? {}) as NawakMetadata;
    const actions = Rulebook.getAvailableActions(state, userId);
    const hand =
      Array.isArray(meta.currentChallenge?.answers) ? meta.currentChallenge.answers : [];
    const panels = buildLamaLikePanels({
      hand,
      discardLabel: 'Défis disponibles',
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
      actions: formatPresenterActions(actions, (action) => this.buildLabel(action, meta, state)),
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
    } as any;
  }

  private buildLabel(
    action: { type: string; payload?: Record<string, unknown> },
    meta: NawakMetadata,
    state: GameStateEntity,
  ): string {
    if (action.type === 'choose_answer') {
      const index = Number(action.payload?.answerIndex ?? 0);
      const answer =
        meta.currentChallenge.answers?.[index] ?? `réponse ${index + 1}`;
      return `Choisir “${answer}”`;
    }
    if (action.type === 'vote_answer') {
      const target = Number(action.payload?.targetPlayerId ?? 0);
      return `Voter pour ${this.playerName(state.players, target)}`;
    }
    return action.type;
  }

  private playerName(players: GameStateEntity['players'], playerId: number): string {
    const list = Array.isArray(players) ? players : [];
    const player = list.find((p) => p?.id === playerId);
    return player?.username?.trim() || `Joueur ${playerId}`;
  }
}
