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
    const meta = (state.metadata ?? {}) as AFondLesBallonsMetadata;
    const players = Array.isArray(state.players) ? state.players : [];
    const me = players.find((p) => p?.id === userId);
    const stateRecord = state as unknown as Record<string, unknown>;
    const stateExtras = asRecord(stateRecord.extras);

    const extras = {
      ...stateExtras,
      currentPlayerView: {
        id: userId,
        username: me?.username ?? `Joueur ${userId}`,
      },
      ui: {
        panels: {
          position: {
            title: 'Position',
            message: this.buildAllPlayersPositionMessage(
              meta.tiles,
              meta.positions,
              players,
            ),
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
      board: this.boardPayload.buildTilesPositionsLaps(
        meta.tiles,
        meta.positions,
      ),
    } as GameStateWithActions;
  }

  private buildAllPlayersPositionMessage(
    tilesRaw: unknown,
    positionsRaw: unknown,
    playersRaw: unknown,
  ): string {
    const board = this.boardPayload.buildTilesPositionsLaps(
      tilesRaw,
      positionsRaw,
    );
    const totalTiles = Array.isArray(board.tiles) ? board.tiles.length : 0;
    const positions = board.positions ?? {};
    if (totalTiles <= 0 || Object.keys(positions).length === 0) {
      return 'Position: inconnue.';
    }

    const players = Array.isArray(playersRaw) ? playersRaw : [];
    const namesById = new Map<number, string>();
    for (const p of players) {
      if (!p || typeof p.id !== 'number') continue;
      const name = String(p.username ?? '').trim();
      namesById.set(p.id, name.length > 0 ? name : `Joueur ${p.id}`);
    }

    const parts = Object.entries(positions)
      .map(([playerIdRaw, posRaw]) => {
        const playerId = Number(playerIdRaw);
        const name = Number.isFinite(playerId)
          ? (namesById.get(playerId) ?? `Joueur ${playerId}`)
          : `Joueur ${playerIdRaw}`;
        const pos = Number(posRaw);
        const caseNumber = Number.isFinite(pos)
          ? Math.max(1, Math.trunc(pos) + 1)
          : null;
        if (caseNumber == null) {
          return null;
        }
        return `${name} case ${caseNumber}/${totalTiles}`;
      })
      .filter((entry): entry is string => typeof entry === 'string');

    if (parts.length === 0) {
      return 'Position: inconnue.';
    }

    return `Positions. ${parts.join('. ')}.`;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}
