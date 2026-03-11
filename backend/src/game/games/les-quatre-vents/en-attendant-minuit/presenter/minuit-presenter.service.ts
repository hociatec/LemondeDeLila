import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';

import { formatPresenterActions } from '../../../../presenters/actions-presenter.helper';
import { BoardPayloadService } from '../../../../modules/board/services/board-payload.service';
import { MINUIT_GAME } from '../definitions/minuit.definition';
import * as Rulebook from '../rulebook/rulebook';
import type { MinuitMetadata } from '../model/minuit.types';

@Injectable()
export class MinuitPresenterService {
  constructor(private readonly boardPayload: BoardPayloadService) {}

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const actions = Rulebook.getAvailableActions(state, userId);
    const meta = (state.metadata ?? {}) as MinuitMetadata;
    const players = Array.isArray(state.players) ? state.players : [];
    const me = players.find((p) => p?.id === userId);

    const pendingQuiz =
      meta.pendingQuiz && meta.pendingQuiz.playerId === userId
        ? {
            type: 'quiz',
            label: 'Réponses possibles',
            question: meta.pendingQuiz.question,
            choices: meta.pendingQuiz.choices,
            playerId: meta.pendingQuiz.playerId,
            blocking: true,
          }
        : null;
    const pending =
      pendingQuiz ??
      (state.pending && state.pending.playerId === userId
        ? state.pending
        : null);
    const stateRecord = state as unknown as Record<string, unknown>;
    const extrasBase =
      stateRecord.extras && typeof stateRecord.extras === 'object'
        ? (stateRecord.extras as Record<string, unknown>)
        : {};

    return {
      ...state,
      catalog: {
        phases: MINUIT_GAME.phaseOrder.map((p) => p.id),
        victory: null,
      },
      actions: formatPresenterActions(actions),
      pending,
      extras: {
        ...extrasBase,
        currentPlayerView: {
          id: userId,
          username: me?.username ?? `Joueur ${userId}`,
        },
        ui: {
          panels: {},
        },
      },
      board: this.boardPayload.buildTilesPositionsLaps(
        meta.tiles,
        meta.positions,
      ),
    };
  }
}
