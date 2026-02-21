import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';

import { formatPresenterActions } from '../../../../presenters/actions-presenter.helper';
import { BoardPayloadService } from '../../../../modules/board/services/board-payload.service';
import { AVENTURE_SAUVAGE_GAME } from '../definitions/game.definition';
import * as Rulebook from '../rulebook/rulebook';
import type { AventureSauvageMetadata } from '../model/aventure-sauvage-state.entity';

@Injectable()
export class AventureSauvagePresenterService {
  constructor(private readonly boardPayload: BoardPayloadService) {}

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const actions = Rulebook.getAvailableActions(state, userId);
    const meta = (state.metadata ?? {}) as AventureSauvageMetadata;
    const players = Array.isArray(state.players) ? state.players : [];
    const me = players.find((p) => p?.id === userId);
    const stateRecord = state as unknown as Record<string, unknown>;
    const stateExtras = asRecord(stateRecord.extras);

    const extras = {
      ...stateExtras,
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
        },
      },
    };

    return {
      ...state,
      catalog: {
        phases: AVENTURE_SAUVAGE_GAME.phaseOrder.map((p) => p.id),
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
