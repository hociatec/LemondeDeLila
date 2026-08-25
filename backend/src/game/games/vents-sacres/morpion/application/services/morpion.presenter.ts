import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../../../core/application/models/game-action.model';
import type {
  GameStateEntity,
  PendingState,
} from '../../../../../core/application/models/game-state.model';
import { BasePresenterService } from '../../../../../core/application/services/base-presenter.service';
import { GridCellActionsService } from '../../../../../grid/application/services/grid-cell-actions.service';
import type { MorpionMetadata } from '../../model/morpion.model';
import { MORPION_PAWNS } from '../../definitions/morpion.pawns';

type MorpionEntity = {
  id: string;
  type: 'mark';
  ownerId: number;
  x: number;
  y: number;
  glyph: string;
};

type PendingChoosePawn = {
  type?: string;
  playerId?: number;
  data?: {
    pawns?: Array<{ id?: string | number }>;
  };
};

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
    const glyphByPlayerId = meta.glyphByPlayerId ?? {};

    const entities: MorpionEntity[] = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = y * size + x;
        const ownerId = board[idx] ?? 0;
        if (!ownerId) continue;
        const mapped = String(glyphByPlayerId?.[String(ownerId)] ?? '')
          .trim()
          .toLowerCase();
        const mappedPawn = MORPION_PAWNS.find((pawn) => pawn.id === mapped);
        const glyph = mappedPawn?.glyph
          ? mappedPawn.glyph
          : ownerId === player0
            ? (MORPION_PAWNS[0]?.glyph ?? 'V')
            : ownerId === player1
              ? (MORPION_PAWNS[1]?.glyph ?? 'E')
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
    const winnerId = meta.winnerId ?? null;
    const draw = Boolean(meta.draw);

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
    };
  }

  protected buildCatalog(): { phases: string[]; victory: { type: string } } {
    return { phases: ['play'], victory: { type: 'line_3' } };
  }

  protected getAvailableActionsForUser(
    state: GameStateEntity,
    userId: number,
  ): GameSingleActionDto[] {
    if (!this.isStarted(state)) return [];

    const pending = state.pending as PendingChoosePawn | null;
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
        .map((pawn: { id?: string | number }) => this.normalizePawnId(pawn?.id))
        .filter((id: string | null): id is string => id != null)
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

  protected buildPendingState(
    state: GameStateEntity,
    _metadata: Record<string, unknown>,
    _currentPlayerId: number | null,
  ): PendingState | null {
    return state.pending ?? null;
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
    _currentPlayerId: number | null,
  ): Record<string, unknown> {
    const base = this.getBaseExtras(state);
    const meta = (state.metadata ?? {}) as MorpionMetadata;
    const board = Array.isArray(meta.board) ? meta.board : [];
    const emptyCount = board.filter((v) => Number(v ?? 0) === 0).length;
    const playInfo =
      String(state.status ?? '').toLowerCase() === 'started'
        ? `Cases libres: ${emptyCount}. Entrée: jouer sur la case focus.`
        : 'Partie non démarrée.';

    return {
      ...base,
      ui: {
        panels: {
          play: {
            title: 'Coups',
            message: playInfo,
          },
        },
      },
    };
  }

  private normalizePawnId(value: unknown): string | null {
    const normalized =
      typeof value === 'string'
        ? value.trim().toLowerCase()
        : typeof value === 'number'
          ? String(value).trim().toLowerCase()
          : '';
    if (!normalized) return null;

    if (normalized === 'x') return MORPION_PAWNS[0]?.id ?? null;
    if (normalized === 'o') return MORPION_PAWNS[1]?.id ?? null;

    return MORPION_PAWNS.some((pawn) => pawn.id === normalized)
      ? normalized
      : null;
  }
}
