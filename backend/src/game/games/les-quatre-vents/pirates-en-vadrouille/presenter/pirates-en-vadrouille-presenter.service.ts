import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import { BoardPayloadService } from '../../../../modules/board/services/board-payload.service';
import { PIRATES_GAME } from '../definitions/pirates-en-vadrouille.definition';
import * as Rulebook from '../rulebook/rulebook';
import type { PiratesEnVadrouilleCollection, PiratesEnVadrouilleMetadata } from '../model/pirates-en-vadrouille-state.entity';

@Injectable()
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

    return {
      ...state,
      catalog: {
        phases: PIRATES_GAME.phaseOrder.map((p) => p.id),
        victory: null,
      },
      actions: actions.map((action) => ({
        type: action.type,
        label: action.type === 'roll' ? 'Lancer le dé' : action.type,
        payload: action.payload ?? {},
      })),
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
            collection: {
              title: 'Cartes & pièces',
              message: this.buildCollectionMessage(meta.collections?.[userId] ?? null),
            },
          },
        },
      },
      board: this.boardPayload.buildTilesPositionsLaps(meta.tiles, meta.positions),
    } as any;
  }

  private buildCollectionMessage(collection: PiratesEnVadrouilleCollection | null): string {
    if (!collection) return 'Cartes : (aucune) | Pièces : 0';
    const cards = [
      `Trésors : ${collection.treasures.length}`,
      `Bonus : ${collection.bonus.length}`,
      `Obstacles : ${collection.obstacles.length}`,
    ];
    return `${cards.join(' | ')} | Pièces : ${collection.goldPieces}`;
  }

  private getMeta(state: GameStateEntity): PiratesEnVadrouilleMetadata {
    return (state.metadata ?? {}) as PiratesEnVadrouilleMetadata;
  }
}
