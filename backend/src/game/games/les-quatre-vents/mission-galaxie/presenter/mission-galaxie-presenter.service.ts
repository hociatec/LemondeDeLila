import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';

import { formatPresenterActions } from '../../../../presenters/actions-presenter.helper';
import { BoardPayloadService } from '../../../../modules/board/services/board-payload.service';
import { MISSION_GALAXIE_GAME } from '../definitions/mission-galaxie.definition';
import * as Rulebook from '../rulebook/rulebook';
import type { MissionGalaxieMetadata } from '../model/mission-galaxie-state.entity';

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

@Injectable()
export class MissionGalaxiePresenterService {
  constructor(private readonly boardPayload: BoardPayloadService) {}

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const actions = Rulebook.getAvailableActions(state, userId);
    const meta = (state.metadata ?? {}) as MissionGalaxieMetadata;
    const players = Array.isArray(state.players) ? state.players : [];
    const me = players.find((p) => p?.id === userId);

    const pendingContext = meta.pendingContext ?? null;
    const pendingCard =
      pendingContext && pendingContext.kind !== 'choosePlayerMove'
        ? {
            kind: pendingContext.kind,
            title: pendingContext.card.title,
            prompt: pendingContext.card.prompt,
            choices: pendingContext.card.choices,
          }
        : null;

    return {
      ...state,
      catalog: {
        phases: MISSION_GALAXIE_GAME.phaseOrder.map((p) => p.id),
        victory: null,
      },
      actions: formatPresenterActions(actions),
      pending: state.pending ?? null,
      extras: {
        ...asRecord(state.extras),
        currentPlayerView: {
          id: userId,
          username: me?.username ?? `Joueur ${userId}`,
        },
        pendingCard,
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
