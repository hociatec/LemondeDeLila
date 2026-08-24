import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type { GameStateWithActions } from '../../../../../application/models/game-action.model';

import { formatPresenterActions } from '../../../../../application/helpers/actions-presenter.helper';
import { BoardPayloadService } from '../../../../../application/services/board-payload.service';
import { CA_DERAPE_GAME } from '../../definitions/ca.definition';
import * as Rulebook from '../../rulebook/ca.rulebook';
import type { CaMetadata } from '../../model/ca.types';

export class CaPresenterService {
  constructor(private readonly boardPayload: BoardPayloadService) {}

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const actions = Rulebook.getAvailableActions(state, userId);
    const meta = this.getMeta(state);
    const players = Array.isArray(state.players) ? state.players : [];
    const me = players.find((p) => p?.id === userId);

    return {
      ...state,
      catalog: {
        phases: CA_DERAPE_GAME.phaseOrder.map((p) => p.id),
        victory: null,
      },
      actions: formatPresenterActions(actions),
      pending: state.pending ?? null,
      extras: {
        ...asRecord(asRecord(state).extras),
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
    } as GameStateWithActions;
  }

  private getMeta(state: GameStateEntity): CaMetadata {
    return (state.metadata ?? {}) as CaMetadata;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value == null || typeof value !== 'object') return {};
  return value as Record<string, unknown>;
}



