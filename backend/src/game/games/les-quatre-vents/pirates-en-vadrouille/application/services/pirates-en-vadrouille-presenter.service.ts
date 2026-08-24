import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type { GameStateWithActions } from '../../../../../models/game-action.model';

import { formatPresenterActions } from '../../../../../application/helpers/actions-presenter.helper';
import { BoardPayloadService } from '../../../../../application/services/board-payload.service';
import { PIRATES_GAME } from '../../definitions/pirates-en-vadrouille.definition';
import * as Rulebook from '../../rulebook/rulebook';
import type {
  PiratesEnVadrouilleCollection,
  PiratesEnVadrouilleMetadata,
} from '../../model/pirates-en-vadrouille-state.model';

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

export class PiratesEnVadrouillePresenterService {
  constructor(private readonly boardPayload: BoardPayloadService) {}

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const actions = Rulebook.getAvailableActions(state, userId);
    const meta = this.getMeta(state);
    const players = Array.isArray(state.players) ? state.players : [];
    const me = players.find((p) => p?.id === userId);
    const scoreLines = players.map((p) => {
      const name =
        typeof p?.username === 'string' && p.username.trim().length > 0
          ? p.username.trim()
          : `Joueur ${p?.id ?? '?'}`;
      const collection = meta.collections?.[p?.id ?? -1] ?? null;
      const treasures = Array.isArray(collection?.treasures)
        ? collection.treasures.length
        : 0;
      return `${name} : ${treasures} trÃƒÆ’Ã‚Â©sor${treasures > 1 ? 's' : ''}`;
    });

    return {
      ...state,
      catalog: {
        phases: PIRATES_GAME.phaseOrder.map((p) => p.id),
        victory: null,
      },
      actions: formatPresenterActions(actions, (action) =>
        action.type === 'roll' ? 'Lancer le dÃƒÆ’Ã‚Â©' : action.type,
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
            collection: {
              title: 'Cartes & piÃƒÆ’Ã‚Â¨ces',
              message: this.buildCollectionMessage(
                meta.collections?.[userId] ?? null,
              ),
            },
            score: {
              title: 'TrÃƒÆ’Ã‚Â©sors',
              message: scoreLines.length
                ? scoreLines.join('\n')
                : 'TrÃƒÆ’Ã‚Â©sors: indisponible.',
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

  private buildCollectionMessage(
    collection: PiratesEnVadrouilleCollection | null,
  ): string {
    if (!collection) return 'Cartes : (aucune) | PiÃƒÆ’Ã‚Â¨ces : 0';
    const cards = [
      `TrÃƒÆ’Ã‚Â©sors : ${collection.treasures.length}`,
      `Bonus : ${collection.bonus.length}`,
      `Obstacles : ${collection.obstacles.length}`,
    ];
    return `${cards.join(' | ')} | PiÃƒÆ’Ã‚Â¨ces : ${collection.goldPieces}`;
  }

  private getMeta(state: GameStateEntity): PiratesEnVadrouilleMetadata {
    return (state.metadata ?? {}) as PiratesEnVadrouilleMetadata;
  }
}






