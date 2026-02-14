import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';

import { formatPresenterActions } from '../../../../presenters/actions-presenter.helper';
import { BoardPayloadService } from '../../../../modules/board/services/board-payload.service';
import { GALOPONS_GAME } from '../definitions/galopons.definition';
import * as Rulebook from '../rulebook/rulebook';
import type { GaloponsMetadata } from '../model/galopons.types';

@Injectable()
export class GaloponsPresenterService {
  constructor(private readonly boardPayload: BoardPayloadService) {}

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const actions = Rulebook.getAvailableActions(state, userId);
    const meta = (state.metadata ?? {}) as any as GaloponsMetadata;
    const players = Array.isArray(state.players) ? state.players : [];
    const me = players.find((p) => p?.id === userId);
    const applesLines = players.map((p) => {
      const name =
        typeof p?.username === 'string' && p.username.trim().length > 0
          ? p.username.trim()
          : `Joueur ${p?.id ?? '?'}`;
      const count = meta.apples?.[p?.id ?? -1] ?? 0;
      return `${name} : ${count} pomme${count > 1 ? 's' : ''}`;
    });

    return {
      ...state,
      catalog: {
        phases: GALOPONS_GAME.phaseOrder.map((p) => p.id),
        victory: null,
      },
      actions: formatPresenterActions(actions),
      pending: state.pending ?? null,
      extras: {
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
            apples: {
              title: 'Pommes',
              message: applesLines.length
                ? applesLines.join('\n')
                : 'Pommes: indisponible.',
            },
          },
        },
        apples: meta.apples ?? {},
      },
      board: this.boardPayload.buildTilesPositionsLaps(meta.tiles, meta.positions),
    } as any;
  }
}
