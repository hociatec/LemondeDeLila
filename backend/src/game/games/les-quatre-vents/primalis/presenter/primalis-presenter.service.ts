import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import { BoardPayloadService } from '../../../../modules/board/services/board-payload.service';
import { PRIMALIS_GAME } from '../definitions/primalis.definition';
import type { PrimalisMetadata, PrimalisResources } from '../model/primalis-state.entity';
import * as Rulebook from '../rulebook/rulebook';

@Injectable()
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

    return {
      ...state,
      catalog: {
        phases: PRIMALIS_GAME.phaseOrder.map((p) => p.id),
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
            ressources: {
              title: 'Tribu',
              message: this.renderResources(myResources),
            },
          },
        },
      },
      board: this.boardPayload.buildTilesPositionsLaps(meta.tiles, meta.positions),
    } as any;
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

  private getResources(meta: PrimalisMetadata, playerId: number): PrimalisResources {
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
