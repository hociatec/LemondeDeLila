import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';

import { formatPresenterActions } from '../../../../presenters/actions-presenter.helper';
import { BoardPayloadService } from '../../../../modules/board/services/board-payload.service';
import { VOYAGE_GAME } from '../definitions/voyage.definition';
import * as Rulebook from '../rulebook/rulebook';
import type { VoyageMetadata } from '../model/voyage.types';

@Injectable()
export class VoyagePresenterService {
  constructor(private readonly boardPayload: BoardPayloadService) {}

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const actions = Rulebook.getAvailableActions(state, userId);
    const meta = this.getMeta(state);
    const players = Array.isArray(state.players) ? state.players : [];
    const me = players.find((p) => p?.id === userId);

    const c = meta.collections?.[userId] ?? {
      legend: 0,
      farce: 0,
      treasure: 0,
      landscape: 0,
    };
    const total =
      (c.legend ?? 0) + (c.farce ?? 0) + (c.treasure ?? 0) + (c.landscape ?? 0);

    const stateRecord = asRecord(state);
    const baseExtras = asRecord(stateRecord.extras);
    return {
      ...state,
      catalog: {
        phases: VOYAGE_GAME.phaseOrder.map((p) => p.id),
        victory: null,
      },
      actions: formatPresenterActions(actions),
      pending: state.pending ?? null,
      extras: {
        ...baseExtras,
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
      board: this.boardPayload.buildTilesPositionsLaps(
        meta.tiles,
        meta.positions,
      ),
    } as GameStateWithActions;
  }

  private getMeta(state: GameStateEntity): VoyageMetadata {
    return (state.metadata ?? {}) as VoyageMetadata;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value == null || typeof value !== 'object') return {};
  return value as Record<string, unknown>;
}
