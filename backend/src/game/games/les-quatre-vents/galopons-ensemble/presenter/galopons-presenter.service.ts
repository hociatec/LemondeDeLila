import { Injectable } from '@nestjs/common';
import type {
  GameStateEntity,
  PendingState,
} from '../../../../core/entities/game-state.entity';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../../engine/dto/game-action.dto';
import { BasePresenterService } from '../../../../engine/abstract/base-presenter.service';
import { BoardPayloadService } from '../../../../modules/board/services/board-payload.service';
import { GALOPONS_GAME } from '../definitions/galopons.definition';
import * as Rulebook from '../rulebook/rulebook';
import type { GaloponsMetadata } from '../model/galopons.types';

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

@Injectable()
export class GaloponsPresenterService extends BasePresenterService {
  constructor(private readonly boardPayload: BoardPayloadService) {
    super();
  }

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const actions = Rulebook.getAvailableActions(state, userId);
    const exposed = this.buildExposedStateForUser(state, userId, actions);
    const meta = this.getMeta(state);

    return {
      ...exposed,
      board: this.boardPayload.buildTilesPositionsLaps(
        meta.tiles,
        meta.positions,
      ),
    };
  }

  protected buildCatalog(): { phases: string[]; victory: unknown } {
    return {
      phases: GALOPONS_GAME.phaseOrder.map((phase) => phase.id),
      victory: null,
    };
  }

  protected getAvailableActionsForUser(
    state: GameStateEntity,
    userId: number,
  ): GameSingleActionDto[] {
    return Rulebook.getAvailableActions(state, userId);
  }

  protected buildPendingState(
    state: GameStateEntity,
    _metadata: Record<string, unknown>,
    _currentPlayerId: number | null,
  ): PendingState | null {
    return state.pending ?? null;
  }

  protected buildExtras(
    state: GameStateEntity,
    metadata: Record<string, unknown>,
    currentPlayerId: number | null,
  ): Record<string, unknown> {
    const meta = metadata as GaloponsMetadata;
    const players = Array.isArray(state.players) ? state.players : [];
    const applesLines = players.map((player) => {
      const name =
        typeof player?.username === 'string' && player.username.trim().length > 0
          ? player.username.trim()
          : `Joueur ${player?.id ?? '?'}`;
      const count = meta.apples?.[player?.id ?? -1] ?? 0;
      return `${name} : ${count} pomme${count > 1 ? 's' : ''}`;
    });

    return {
      ...asRecord(state.extras),
      currentPlayerView:
        currentPlayerId == null
          ? null
          : {
              id: currentPlayerId,
              username:
                players.find((player) => player?.id === currentPlayerId)
                  ?.username ?? `Joueur ${currentPlayerId}`,
            },
      ui: {
        panels: {
          apples: {
            title: 'Pommes',
            message: applesLines.length
              ? applesLines.join('\n')
              : 'Pommes: indisponible.',
          },
        },
      },
      apples: meta.apples ?? {},
    };
  }

  protected buildExtrasForUser(
    state: GameStateEntity,
    metadata: Record<string, unknown>,
    userId: number,
    _currentPlayerId: number | null,
  ): Record<string, unknown> {
    const base = this.buildExtras(state, metadata, userId);
    const players = Array.isArray(state.players) ? state.players : [];
    const me = players.find((player) => player?.id === userId);

    return {
      ...base,
      currentPlayerView: {
        id: userId,
        username: me?.username ?? `Joueur ${userId}`,
      },
    };
  }

  private getMeta(state: GameStateEntity): GaloponsMetadata {
    return (state.metadata ?? {}) as GaloponsMetadata;
  }
}
