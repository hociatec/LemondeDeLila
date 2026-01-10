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

    const positions: Record<string, number> = {};
    for (const [pid, pos] of Object.entries(meta?.pawnsByPlayerId ?? {})) {
      if (!pos) continue;
      const idx = pos.y * size + pos.x;
      positions[String(pid)] = idx;
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

        if (type === 'corridor_move') return 'DÇ¸placer ici';
        if (type === 'corridor_place_wall' && o === 'h')
          return 'Mur horizontal ici';
        if (type === 'corridor_place_wall' && o === 'v')
          return 'Mur vertical ici';
        return String((action as any)?.label ?? (action as any)?.type ?? '').trim();
      },
    );

    const blockedEdges = this.gridBlockedEdges.buildFromWalls(size, meta?.walls);
    const cellTags = this.buildGridCellTags(state, userId, size);

    return {
      ...exposed,
      extras: {
        ...(exposed.extras ?? {}),
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
            viewerIsTurn ? 'Ç? vous de jouer.' : "Tour de l'adversaire.",
            `Murs restants : ${(meta?.wallsRemainingByPlayerId ?? {})[String(userId)] ?? 0}`,
          ],
        },
      },
      board: {
        tiles: Array.from({ length: size * size }, (_, i) => ({
          x: i % size,
          y: Math.floor(i / size),
        })),
        positions,
      },
    } as any;
  }

  private buildGridCellTags(
    state: GameStateEntity,
    userId: number,
    size: number,
  ): Record<string, string[]> {
    if (!size) return {};

    const players = state.players ?? [];
    const idx = players.findIndex((p) => p?.id === userId);
    if (idx < 0) return {};

    const goalY = idx === 0 ? size - 1 : 0;
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
        payload: { x: w.x, y: w.y, o: w.o, _ui: { key: 'M', kind: 'place_wall' } },
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
