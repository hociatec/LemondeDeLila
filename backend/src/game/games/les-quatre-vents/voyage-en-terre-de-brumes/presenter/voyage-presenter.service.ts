import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import { BoardPayloadService } from '../../../../modules/board/services/board-payload.service';
import { VOYAGE_GAME } from '../definitions/voyage.definition';
import * as Rulebook from '../rulebook/rulebook';
import type { VoyageMetadata } from '../model/voyage.types';

@Injectable()
export class VoyagePresenterService {
  constructor(private readonly boardPayload: BoardPayloadService) {}

  exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions {
    const actions = Rulebook.getAvailableActions(state, userId);
    const meta = (state.metadata ?? {}) as any as VoyageMetadata;
    const players = Array.isArray(state.players) ? state.players : [];
    const me = players.find((p) => p?.id === userId);

    const c = meta.collections?.[userId] ?? {
      legend: 0,
      farce: 0,
      treasure: 0,
      landscape: 0,
    };
    const total = (c.legend ?? 0) + (c.farce ?? 0) + (c.treasure ?? 0) + (c.landscape ?? 0);

    return {
      ...state,
      catalog: {
        phases: VOYAGE_GAME.phaseOrder.map((p) => p.id),
        victory: null,
      },
      actions: actions.map((a) => ({
        type: a.type,
        label: a.type,
        payload: a.payload ?? {},
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
            cards: {
              title: 'Cartes',
              message: `Total ${total} (Légendes ${c.legend}, Trésors ${c.treasure}, Paysages ${c.landscape}).`,
            },
          },
        },
      },
      board: this.boardPayload.buildTilesPositionsLaps(meta.tiles, meta.positions),
    } as any;
  }
}

