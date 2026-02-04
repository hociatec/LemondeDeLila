import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import * as Rulebook from '../rulebook/rulebook';
import { ABSURDISSIMES_GAME } from '../definitions/game.definition';
import type { AbsurdissimesMetadata } from '../model/les-absurdissimes-state.entity';
import {
  buildLamaLikePanels,
  summarizeHandCounts,
} from '../../../../presenters/lamalike-presenter.helper';

@Injectable()
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
      actions: actions.map((action) => ({
        type: action.type,
        label: this.buildLabel(action, state),
        payload: action.payload ?? {},
      })),
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
    } as any;
  }

  private buildLabel(
    action: { type: string; payload?: Record<string, unknown> },
    state: GameStateEntity,
  ): string {
    if (action.type === 'play_card') {
      const cardId = String(action.payload?.cardId ?? '');
      return cardId ? `Jouer ${cardId}` : 'Jouer une carte';
    }
    if (action.type === 'judge_pick') {
      const winnerId = Number(action.payload?.winnerId ?? 0);
      return `Choisir ${this.playerName(state.players, winnerId)}`;
    }
    return action.type;
  }

  private playerName(players: GameStateEntity['players'], playerId: number): string {
    const list = Array.isArray(players) ? players : [];
    const player = list.find((p) => p?.id === playerId);
    return player?.username?.trim() || `Joueur ${playerId}`;
  }
}
