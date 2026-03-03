import { Injectable } from '@nestjs/common';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import { BasePresenterService } from '../../../engine/abstract/base-presenter.service';
import { GridCellActionsService } from '../../../modules/grid/services/grid-cell-actions.service';
import type { MorpionMetadata } from './model/morpion.model';

@Injectable()
export class MorpionPresenter extends BasePresenterService {
  constructor(private readonly gridCellActions: GridCellActionsService) {
    super();
  }

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const meta = (state.metadata ?? {}) as MorpionMetadata;
    const exposed = this.buildExposedStateForUser(state, userId);

    if (!this.isStarted(state)) {
      return exposed;
    }

    const size = meta.size ?? 3;
    const board = Array.isArray(meta.board) ? meta.board : [];
    const players = state.players ?? [];
    const player0 = players[0]?.id ?? 1;
    const player1 = players[1]?.id ?? 2;
    const glyphByPlayerId = (meta as any)?.glyphByPlayerId ?? {};

    const entities: Array<any> = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = y * size + x;
        const ownerId = board[idx] ?? 0;
        if (!ownerId) continue;
        const mapped = String(glyphByPlayerId?.[String(ownerId)] ?? '')
          .trim()
          .toUpperCase();
        const glyph =
          mapped === 'X' || mapped === 'O'
            ? mapped
            : ownerId === player0
              ? 'X'
              : ownerId === player1
                ? 'O'
                : '@';
        entities.push({
          id: `mark:${idx}`,
          type: 'mark',
          ownerId,
          x,
          y,
          glyph,
        });
      }
    }

    const cellActions = this.gridCellActions.buildFromActions(
      exposed.actions ?? [],
      () => 'Jouer ici',
    );

    const currentPlayerId = state.turn?.currentPlayerId ?? null;
    const winnerId = (meta as any)?.winnerId ?? null;
    const draw = Boolean((meta as any)?.draw);

    const statusLines = [
      winnerId
        ? `Gagnant : ${players.find((p) => p?.id === winnerId)?.username ?? `#${winnerId}`}`
        : draw
          ? 'Match nul.'
          : currentPlayerId === userId
            ? 'À vous de jouer.'
            : "Tour de l'adversaire.",
    ];

    return {
      ...exposed,
      extras: {
        ...(exposed.extras ?? {}),
        grid: {
          kind: 'grid',
          size,
          entities,
          cellActions,
          statusLines,
        },
      },
      board: {
        tiles: Array.from({ length: size * size }, (_, i) => ({
          x: i % size,
          y: Math.floor(i / size),
        })),
      },
    } as any;
  }

  protected buildCatalog(): { phases: string[]; victory: any } {
    return { phases: ['play'], victory: { type: 'line_3' } };
  }

  protected getAvailableActionsForUser(
    state: GameStateEntity,
    userId: number,
  ): GameSingleActionDto[] {
    if (!this.isStarted(state)) return [];

    const pending = state.pending as any;
    const pendingType = String(pending?.type ?? '')
      .trim()
      .toLowerCase();
    if (pendingType === 'choose_pawn') {
      if (Number(pending?.playerId) !== userId) {
        return [];
      }
      const pawns = Array.isArray(pending?.data?.pawns)
        ? pending.data.pawns
        : [];
      return pawns
        .map((pawn: any) =>
          String(pawn?.id ?? '')
            .trim()
            .toUpperCase(),
        )
        .filter((id: string) => id === 'X' || id === 'O')
        .map((pawnId: string) => ({
          type: 'choose_pawn',
          payload: { pawnId },
        }));
    }

    if (state.turn?.currentPlayerId !== userId) return [];
    const meta = (state.metadata ?? {}) as MorpionMetadata;
    const size = meta.size ?? 3;
    const board = Array.isArray(meta.board) ? meta.board : [];

    const out: GameSingleActionDto[] = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = y * size + x;
        if ((board[idx] ?? 0) !== 0) continue;
        out.push({
          type: 'morpion_play',
          payload: { x, y, _ui: { key: 'ENTER', kind: 'play' } },
        });
      }
    }
    return out;
  }

  protected buildPendingState(): any {
    return null;
  }

  protected buildExtras(
    state: GameStateEntity,
    _metadata: MorpionMetadata,
    _currentPlayerId: number | null,
  ): Record<string, unknown> {
    return this.getBaseExtras(state);
  }

  protected buildExtrasForUser(
    state: GameStateEntity,
    _metadata: MorpionMetadata,
    _userId: number,
    currentPlayerId: number | null,
  ): Record<string, unknown> {
    const base = this.getBaseExtras(state);
    const meta = (state.metadata ?? {}) as MorpionMetadata;
    const size = meta.size ?? 3;
    const board = Array.isArray(meta.board) ? meta.board : [];
    const players = Array.isArray(state.players) ? state.players : [];
    const glyphByPlayerId = (meta as any)?.glyphByPlayerId ?? {};

    const glyphForOwner = (ownerId: number): string => {
      const mapped = String(glyphByPlayerId?.[String(ownerId)] ?? '')
        .trim()
        .toUpperCase();
      if (mapped === 'X' || mapped === 'O') return mapped;
      const player0 = players[0]?.id ?? 1;
      const player1 = players[1]?.id ?? 2;
      if (ownerId === player0) return 'X';
      if (ownerId === player1) return 'O';
      return '@';
    };

    const rowLabel = (y: number) => {
      const cells: string[] = [];
      for (let x = 0; x < size; x += 1) {
        const idx = y * size + x;
        const ownerId = Number(board[idx] ?? 0);
        cells.push(ownerId ? glyphForOwner(ownerId) : '.');
      }
      return cells.join(' ');
    };

    const boardMessage = [
      `Plateau:`,
      rowLabel(0),
      rowLabel(1),
      rowLabel(2),
    ].join(' ');

    const emptyCount = board.filter((v) => Number(v ?? 0) === 0).length;
    const who =
      typeof currentPlayerId === 'number'
        ? (players.find((p) => p?.id === currentPlayerId)?.username ??
          `#${currentPlayerId}`)
        : 'inconnu';

    const playInfo =
      String(state.status ?? '').toLowerCase() === 'started'
        ? `Cases libres: ${emptyCount}. Entrée: jouer sur la case focus.`
        : 'Partie non démarrée.';

    return {
      ...base,
      ui: {
        panels: {
          position: {
            title: 'Plateau',
            message: `Tour: ${who}. ${boardMessage}`.trim(),
          },
          play: {
            title: 'Coups',
            message: playInfo,
          },
        },
      },
    };
  }
}
