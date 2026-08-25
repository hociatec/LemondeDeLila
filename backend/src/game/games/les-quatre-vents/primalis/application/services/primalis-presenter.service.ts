import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import type { GameStateWithActions } from '../../../../../core/application/models/game-action.model';

import { formatPresenterActions } from '../../../../../core/application/helpers/actions-presenter.helper';
import { BoardPayloadService } from '../../../../../core/application/services/board-payload.service';
import { PRIMALIS_GAME } from '../../definitions/primalis.definition';
import type {
  PrimalisMetadata,
  PrimalisResources,
} from '../../model/primalis-state.model';
import * as Rulebook from '../../rulebook/rulebook';

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

export class PrimalisPresenterService {
  constructor(private readonly boardPayload: BoardPayloadService) {}

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const actions = Rulebook.getAvailableActions(state, userId);
    const meta = this.getMeta(state);
    const players = Array.isArray(state.players) ? state.players : [];
    const me = players.find((p) => p?.id === userId);
    const myResources = this.getResources(meta, userId);
    const scoreLines = players.map((p) => {
      const name =
        typeof p?.username === 'string' && p.username.trim().length > 0
          ? p.username.trim()
          : `Joueur ${p?.id ?? '?'}`;
      const resources = this.getResources(meta, p?.id ?? -1);
      return `${name} : Feuilles ${resources.leaves}, Herbivores ${resources.herbivores}, Carnivores ${resources.carnivores}`;
    });

    return {
      ...state,
      catalog: {
        phases: PRIMALIS_GAME.phaseOrder.map((p) => p.id),
        victory: null,
      },
      actions: formatPresenterActions(actions, (action) =>
        action.type === 'roll' ? 'Lancer le dé' : action.type,
      ),
      pending: state.pending ?? null,
      extras: {
        ...asRecord(state.extras),
        currentPlayerView: {
          id: userId,
          username: me?.username ?? `Joueur ${userId}`,
        },
        ui: {
          panels: {
            ressources: {
              title: 'Tribu',
              message: this.renderResources(myResources),
            },
            score: {
              title: 'Score',
              message: scoreLines.length
                ? scoreLines.join('\n')
                : 'Score: indisponible.',
            },
          },
        },
      },
      board: this.boardPayload.buildTilesPositionsLaps(
        meta.tiles,
        meta.positions,
      ),
    };
  }

  private renderResources(resources: PrimalisResources): string {
    const pieces = [
      `Herbivores: ${resources.herbivores}`,
      `Carnivores: ${resources.carnivores}`,
      `Œufs: ${resources.eggs}`,
      `Feuilles: ${resources.leaves}`,
    ];
    return pieces.join(' | ');
  }

  private getResources(
    meta: PrimalisMetadata,
    playerId: number,
  ): PrimalisResources {
    return (
      meta.collections?.[playerId] ?? {
        herbivores: 0,
        carnivores: 0,
        eggs: 0,
        leaves: 0,
      }
    );
  }

  private getMeta(state: GameStateEntity): PrimalisMetadata {
    return (state.metadata ?? {}) as PrimalisMetadata;
  }
}








