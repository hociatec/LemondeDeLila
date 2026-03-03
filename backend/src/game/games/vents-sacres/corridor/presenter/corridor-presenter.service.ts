import { Injectable } from '@nestjs/common';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { BasePresenterService } from '../../../../engine/abstract/base-presenter.service';
import type { CorridorMetadata } from '../model/corridor.model';
import * as CorridorRulebook from '../rulebook/rulebook';
import { GridBlockedEdgesService } from '../../../../modules/grid/services/grid-blocked-edges.service';
import { GridCellActionsService } from '../../../../modules/grid/services/grid-cell-actions.service';

@Injectable()
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

    // En setup/finished: on retourne uniquement l'état "table" (pas de grille/plateau).
    if (!this.isStarted(state)) {
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
        const payload = (action as any)?.payload ?? {};
        const type = String((action as any)?.type ?? '').trim();
        const o =
          typeof payload?.o === 'string'
            ? String(payload.o).trim().toLowerCase()
            : '';

        if (type === 'corridor_move') return 'Déplacer ici';
        if (type === 'corridor_place_wall' && o === 'h')
          return 'Mur horizontal ici';
        if (type === 'corridor_place_wall' && o === 'v')
          return 'Mur vertical ici';
        return String(
          (action as any)?.label ?? (action as any)?.type ?? '',
        ).trim();
      },
    );

    const blockedEdges = this.gridBlockedEdges.buildFromWalls(
      size,
      meta?.walls,
    );
    const cellTags = this.buildGridCellTags(state, userId, size);
    const exposedExtras =
      exposed.extras && typeof exposed.extras === 'object'
        ? (exposed.extras as Record<string, any>)
        : {};
    const existingUi =
      exposedExtras.ui && typeof exposedExtras.ui === 'object'
        ? (exposedExtras.ui as Record<string, any>)
        : {};
    const existingPanels =
      existingUi.panels && typeof existingUi.panels === 'object'
        ? (existingUi.panels as Record<string, any>)
        : {};

    return {
      ...exposed,
      extras: {
        ...(exposed.extras ?? {}),
        ui: {
          ...existingUi,
          panels: {
            ...existingPanels,
            position: {
              title: 'Positions',
              message: this.buildPositionPanelMessage(state, size),
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
    } as any;
  }

  private buildPositionPanelMessage(
    state: GameStateEntity,
    size: number,
  ): string {
    const players = Array.isArray(state.players) ? state.players : [];
    const byId = new Map<number, string>();
    for (const p of players) {
      if (!p || typeof p.id !== 'number') continue;
      const name = String(p.username ?? '').trim();
      byId.set(p.id, name.length > 0 ? name : `Joueur ${p.id}`);
    }

    const meta = (state.metadata ?? {}) as CorridorMetadata;
    const positions = meta?.pawnsByPlayerId ?? {};
    const entries: string[] = [];

    for (const [pidRaw, pos] of Object.entries(positions)) {
      if (!pos) continue;
      const pid = Number(pidRaw);
      const name = Number.isFinite(pid)
        ? (byId.get(pid) ?? `Joueur ${pid}`)
        : `Joueur ${pidRaw}`;
      entries.push(
        `${name} ${this.toCellRef(pos.x ?? 0, pos.y ?? 0, size).toLowerCase()}`,
      );
    }

    if (entries.length === 0) {
      return 'Positions inconnues.';
    }

    return `Positions. ${entries.join('. ')}.`;
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

  protected buildCatalog(): { phases: string[]; victory: any } {
    return { phases: ['play'], victory: { type: 'reach_opposite_side' } };
  }

  protected getAvailableActionsForUser(
    state: GameStateEntity,
    userId: number,
  ): GameSingleActionDto[] {
    if (!this.isStarted(state)) return [];
    const pendingType = String(state.pending?.type ?? '')
      .trim()
      .toLowerCase();
    if (pendingType === 'choose_pawn') {
      if (state.pending?.playerId !== userId) {
        return [];
      }
      const pawns = Array.isArray((state.pending?.data as any)?.pawns)
        ? ((state.pending?.data as any).pawns as Array<any>)
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
          } as any;
        })
        .filter((a): a is GameSingleActionDto => a != null);
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

  protected buildPendingState(): any {
    return null;
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
