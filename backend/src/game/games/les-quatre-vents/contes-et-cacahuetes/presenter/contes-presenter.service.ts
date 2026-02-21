import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';

import { formatPresenterActions } from '../../../../presenters/actions-presenter.helper';
import { BoardPayloadService } from '../../../../modules/board/services/board-payload.service';
import * as Rulebook from '../rulebook/rulebook';
import { CONTES_CACAHUETES_GAME } from '../definitions/game.definition';
import type { ContesCacahuetesMetadata } from '../model/contes-et-cacahuetes-state.entity';

@Injectable()
export class ContesPresenterService {
  constructor(private readonly boardPayload: BoardPayloadService) {}

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const actions = Rulebook.getAvailableActions(state, userId);
    const meta = (state.metadata ?? {}) as ContesCacahuetesMetadata;
    const players = Array.isArray(state.players) ? state.players : [];
    const me = players.find((p) => p?.id === userId);
    const scoreLines = players.map((p) => {
      const pid = Number(p?.id);
      const name =
        p?.username && String(p.username).trim()
          ? String(p.username).trim()
          : `Joueur ${pid}`;
      const position = Number(meta.positions?.[pid] ?? 0) + 1;
      return `${name} : case ${position}/60.`;
    });

    const stateRecord = state as unknown as Record<string, unknown>;
    const extras = {
      ...asRecord(stateRecord.extras),
      currentPlayerView: {
        id: userId,
        username: me?.username ?? `Joueur ${userId}`,
      },
      ui: {
        panels: {
          position: {
            title: 'Position',
            message: this.boardPayload.buildPositionPanelMessage({
              tilesRaw: meta.tiles,
              positionsRaw: meta.positions,
              playerId: userId,
            }),
          },
          score: {
            title: 'Score',
            message: scoreLines.join(' '),
          },
        },
      },
    };

    return {
      ...state,
      catalog: {
        phases: CONTES_CACAHUETES_GAME.phaseOrder.map((p) => p.id),
        victory: null,
      },
      actions: formatPresenterActions(actions),
      pending: state.pending ?? null,
      extras,
      board: this.boardPayload.buildTilesPositionsLaps(
        meta.tiles,
        meta.positions,
      ),
    } as GameStateWithActions;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}
