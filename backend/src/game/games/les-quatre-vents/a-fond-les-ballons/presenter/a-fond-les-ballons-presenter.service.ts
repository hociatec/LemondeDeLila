import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';

import { formatPresenterActions } from '../../../../presenters/actions-presenter.helper';
import { BoardPayloadService } from '../../../../modules/board/services/board-payload.service';
import * as Rulebook from '../rulebook/rulebook';
import { A_FOND_LES_BALLONS_GAME } from '../definitions/game.definition';
import type { AFondLesBallonsMetadata } from '../model/a-fond-les-ballons-state.entity';

@Injectable()
export class AFondLesBallonsPresenterService {
  constructor(private readonly boardPayload: BoardPayloadService) {}

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const actions = Rulebook.getAvailableActions(state, userId);
    const meta = (state.metadata ?? {}) as any as AFondLesBallonsMetadata;
    const players = Array.isArray(state.players) ? state.players : [];
    const me = players.find((p) => p?.id === userId);

    const extras = {
      ...(state as any).extras,
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
        phases: A_FOND_LES_BALLONS_GAME.phaseOrder.map((p) => p.id),
        victory: null,
      },
      actions: formatPresenterActions(actions),
      pending: state.pending ?? null,
      extras,
      board: this.boardPayload.buildTilesPositionsLaps(meta.tiles, meta.positions),
    } as any;
  }
}
