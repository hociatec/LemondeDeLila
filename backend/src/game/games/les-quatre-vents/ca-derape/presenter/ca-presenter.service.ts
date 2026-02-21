import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';

import { formatPresenterActions } from '../../../../presenters/actions-presenter.helper';
import { BoardPayloadService } from '../../../../modules/board/services/board-payload.service';
import { CA_DERAPE_GAME } from '../definitions/ca.definition';
import * as Rulebook from '../rulebook/ca.rulebook';
import type { CaMetadata } from '../model/ca.types';

@Injectable()
export class CaPresenterService {
  constructor(private readonly boardPayload: BoardPayloadService) {}

  private buildPositionMessage(meta: CaMetadata, playerId: number): string {
    const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
    const pos = meta.positions?.[playerId];
    if (!Number.isFinite(pos) || tiles.length <= 0) {
      return 'Position: inconnue.';
    }

    const tile = tiles[Math.max(0, Math.min(tiles.length - 1, pos))];
    const caseNumber = Math.max(1, Math.trunc(pos) + 1);
    const total = tiles.length;
    const label = String(tile?.label ?? '').trim();
    const desc = String(tile?.description ?? '').trim();
    const isNeutral = Boolean(tile?.isNeutral);
    const kindLabel = isNeutral ? 'Case neutre' : 'Carte obligatoire';

    const parts = [
      `Case ${caseNumber}/${total}${label ? ` - ${label}` : ''}.`,
      desc ? desc : null,
      `Type: ${kindLabel}.`,
    ].filter(Boolean);

    return parts.join(' ');
  }

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
          panels: {
            position: {
              title: 'Position',
              message: this.buildPositionMessage(meta, userId),
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

  private getMeta(state: GameStateEntity): CaMetadata {
    return (state.metadata ?? {}) as CaMetadata;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value == null || typeof value !== 'object') return {};
  return value as Record<string, unknown>;
}
