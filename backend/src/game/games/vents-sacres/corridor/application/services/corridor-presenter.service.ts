import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../../../application/models/game-action.model';
import type {
  GameStateEntity,
  PendingState,
} from '../../../../../application/models/game-state.model';
import { BasePresenterService } from '../../../../../application/services/base-presenter.service';
import type { CorridorMetadata } from '../../model/corridor.model';
import * as CorridorRulebook from '../../rulebook/rulebook';
import { GridBlockedEdgesService } from '../../../../../application/features/grid/services/grid-blocked-edges.service';
import { GridCellActionsService } from '../../../../../application/features/grid/services/grid-cell-actions.service';

type CorridorActionPayload = {
  x?: number;
  y?: number;
  o?: string;
};

type CorridorPresenterPending = {
  type?: string;
  playerId?: number;
  data?: {
    pawns?: Array<{ id?: string; label?: string }>;
  };
};

type CorridorPresenterExtras = Record<string, unknown>;

export class CorridorPresenterService extends BasePresenterService {
  constructor(
    private readonly gridBlockedEdges: GridBlockedEdgesService,
    private readonly gridCellActions: GridCellActionsService,
  ) {
    super();
  }

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const meta = (state.metadata ?? {}) as CorridorMetadata;
    const exposed = this.buildExposedStateForUser(state, userId);

    if (
      !this.isStarted(state) ||
      String(meta?.setupStep ?? '') === 'setup_config'
    ) {
      return exposed;
    }

    const size = meta?.size ?? 0;
    if (!size || size <= 0) {
      return exposed;
    }

    const currentPlayerId = state.turn?.currentPlayerId ?? null;
    const viewerIsTurn = currentPlayerId === userId;

    const cellActions = this.gridCellActions.buildFromActions(
      exposed.actions ?? [],
      (action) => {
        const payload = (action.payload ?? {}) as CorridorActionPayload;
        const type = String(action.type ?? '').trim();
        const o =
          typeof payload?.o === 'string'
            ? String(payload.o).trim().toLowerCase()
            : '';

        if (type === 'corridor_move') return 'Déplacer ici';
        if (type === 'corridor_place_wall' && o === 'h')
          return 'Mur horizontal ici';
        if (type === 'corridor_place_wall' && o === 'v')
          return 'Mur vertical ici';
        return String(action.label ?? action.type ?? '').trim();
      },
    );

    const blockedEdges = this.gridBlockedEdges.buildFromWalls(
      size,
      meta?.walls,
    );
    const cellTags = this.buildGridCellTags(state, userId, size);
    const exposedExtras =
      exposed.extras && typeof exposed.extras === 'object'
        ? (exposed.extras as CorridorPresenterExtras)
        : {};
    const existingUi =
      exposedExtras.ui && typeof exposedExtras.ui === 'object'
        ? (exposedExtras.ui as CorridorPresenterExtras)
        : {};
    const existingPanels =
      existingUi.panels && typeof existingUi.panels === 'object'
        ? (existingUi.panels as CorridorPresenterExtras)
        : {};

    return {
      ...exposed,
      extras: {
        ...(exposed.extras ?? {}),
        ui: {
          ...existingUi,
          panels: {
            ...existingPanels,
            score: {
              title: 'Murs',
              message: this.buildScorePanelMessage(state),
            },
          },
        },
        grid: {
          kind: 'grid',
          size,
          entities: Object.entries(meta?.pawnsByPlayerId ?? {}).map(
            ([pid, pos]) => ({
              id: `pawn:${pid}`,
              type: 'pawn',
              ownerId: Number(pid),
              x: pos.x,
              y: pos.y,
              glyph: Number(pid) === userId ? '@' : 'O',
            }),
          ),
          blockedEdges,
          cellActions,
          cellTags,
          statusLines: [
            viewerIsTurn ? 'À vous de jouer.' : "Tour de l'adversaire.",
            `Murs restants : ${(meta?.wallsRemainingByPlayerId ?? {})[String(userId)] ?? 0}`,
          ],
        },
      },
    };
  }

  private buildScorePanelMessage(state: GameStateEntity): string {
    const players = Array.isArray(state.players) ? state.players : [];
    const meta = (state.metadata ?? {}) as CorridorMetadata;
    const remainingByPlayerId = meta?.wallsRemainingByPlayerId ?? {};
    const limit = Number.isFinite(Number(meta?.wallsPerPlayer))
      ? Math.trunc(Number(meta.wallsPerPlayer))
      : 0;
    const entries = players.map((player) => {
      const name =
        typeof player?.username === 'string' &&
        player.username.trim().length > 0
          ? player.username.trim()
          : `Joueur ${player?.id ?? '?'}`;
      const remaining = Math.max(
        0,
        Math.trunc(Number(remainingByPlayerId[String(player?.id ?? '')] ?? 0)),
      );
      return `${name} : ${remaining}/${limit} mur(s).`;
    });
    return entries.length ? entries.join(' ') : 'Murs inconnus.';
  }

  private toCellRef(x: number, y: number, size: number): string {
    const safeSize = Number.isFinite(size) && size > 0 ? Math.trunc(size) : 0;
    if (safeSize <= 0) {
      return `${x},${y}`;
    }

    let n = Math.max(1, Math.trunc(Number(x) + 1));
    let col = '';
    while (n > 0) {
      n -= 1;
      col = String.fromCharCode(65 + (n % 26)) + col;
      n = Math.floor(n / 26);
    }
    const row = Math.max(1, safeSize - Math.trunc(Number(y)));
    return `${col}${row}`;
  }

  private buildGridCellTags(
    state: GameStateEntity,
    userId: number,
    size: number,
  ): Record<string, string[]> {
    if (!size) return {};

    const players = state.players ?? [];
    if (!players.some((p) => p?.id === userId)) return {};
    const goalY = CorridorRulebook.getGoalYForPlayer(state, userId);
    if (goalY == null) return {};
    const tags: Record<string, string[]> = {};
    for (let x = 0; x < size; x++) {
      tags[`${x},${goalY}`] = ['Objectif'];
    }
    return tags;
  }

  protected buildCatalog(): { phases: string[]; victory: { type: string } } {
    return { phases: ['play'], victory: { type: 'reach_opposite_side' } };
  }

  protected getAvailableActionsForUser(
    state: GameStateEntity,
    userId: number,
  ): GameSingleActionDto[] {
    if (!this.isStarted(state)) return [];
    const meta = (state.metadata ?? {}) as CorridorMetadata;
    if (String(meta.setupStep ?? '') === 'setup_config') {
      if (state.pending?.playerId !== userId) {
        return [];
      }
      return [{ type: 'corridor_set_config', payload: {} }];
    }
    const pendingType = String(state.pending?.type ?? '')
      .trim()
      .toLowerCase();
    if (pendingType === 'choose_pawn') {
      if (state.pending?.playerId !== userId) {
        return [];
      }
      const pending = (state.pending ??
        null) as CorridorPresenterPending | null;
      const pawns = Array.isArray(pending?.data?.pawns)
        ? pending.data.pawns
        : [];
      return pawns
        .map((pawn) => {
          const id = String(pawn?.id ?? '').trim();
          const label = String(pawn?.label ?? id).trim();
          if (!id) return null;
          return {
            type: 'choose_pawn',
            payload: { pawnId: id },
            label,
          };
        })
        .filter((a): a is NonNullable<typeof a> => a != null);
    }
    const current = this.getCurrentPlayerId(state);
    if (current == null || current !== userId) return [];

    const moves = CorridorRulebook.listLegalPawnMoves(state, userId);
    const walls = CorridorRulebook.listLegalWallPlacements(state, userId);

    return [
      ...moves.map((to) => ({
        type: 'corridor_move',
        payload: { x: to.x, y: to.y, _ui: { key: 'ENTER', kind: 'move' } },
      })),
      ...walls.map((w) => ({
        type: 'corridor_place_wall',
        payload: {
          x: w.x,
          y: w.y,
          o: w.o,
          _ui: { key: 'M', kind: 'place_wall' },
        },
      })),
    ];
  }

  protected buildPendingState(): null {
    return null;
  }

  protected buildPendingStateForUser(
    state: GameStateEntity,
    _metadata: Record<string, unknown>,
    userId: number,
    _currentPlayerId: number | null,
  ): PendingState | null {
    return this.filterPendingForUser(
      ((state.pending ?? null) as PendingState | null) ?? null,
      userId,
    );
  }

  protected buildExtras(
    state: GameStateEntity,
    _metadata: CorridorMetadata,
    _currentPlayerId: number | null,
  ): Record<string, unknown> {
    return this.getBaseExtras(state);
  }

  protected buildExtrasForUser(
    state: GameStateEntity,
    _metadata: CorridorMetadata,
    _userId: number,
    _currentPlayerId: number | null,
  ): Record<string, unknown> {
    return this.getBaseExtras(state);
  }
}
