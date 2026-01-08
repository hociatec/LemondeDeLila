import { Injectable } from '@nestjs/common';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { BasePresenterService } from '../../../../engine/abstract/base-presenter.service';
import type { CorridorMetadata } from '../model/corridor.model';
import * as CorridorRulebook from '../rulebook/rulebook';

@Injectable()
export class CorridorPresenterService extends BasePresenterService {
  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const meta = (state.metadata ?? {}) as CorridorMetadata;
    const exposed = this.buildExposedStateForUser(state, userId);

    const size = meta?.size ?? 0;
    const positions: Record<string, number> = {};
    for (const [pid, pos] of Object.entries(meta?.pawnsByPlayerId ?? {})) {
      if (!pos) continue;
      const idx = pos.y * size + pos.x;
      positions[String(pid)] = idx;
    }

    const currentPlayerId = state.turn?.currentPlayerId ?? null;
    const viewerIsTurn = currentPlayerId === userId;
    const viewerPos = CorridorRulebook.getPawnPos(meta, userId);
    const cellActions = this.buildGridCellActions(exposed);
    const blockedEdges = this.buildBlockedEdges(meta);
    const cellTags = this.buildGridCellTags(state, userId, size);

    return {
      ...exposed,
      extras: {
        ...(exposed.extras ?? {}),
        grid: {
          kind: 'grid',
          size,
          entities: Object.entries(meta?.pawnsByPlayerId ?? {}).map(([pid, pos]) => ({
            id: `pawn:${pid}`,
            type: 'pawn',
            ownerId: Number(pid),
            x: pos.x,
            y: pos.y,
            glyph: Number(pid) === userId ? '●' : '○',
          })),
          blockedEdges,
          cellActions,
          cellTags,
          statusLines: [
            viewerIsTurn ? 'À vous de jouer.' : "Tour de l'adversaire.",
            `Murs restants : ${(meta?.wallsRemainingByPlayerId ?? {})[String(userId)] ?? 0}`,
          ],
        },
        corridor: {
          size,
          pawnsByPlayerId: meta?.pawnsByPlayerId ?? {},
          walls: meta?.walls ?? { h: [], v: [] },
          wallsRemainingByPlayerId: meta?.wallsRemainingByPlayerId ?? {},
          modeHints: viewerIsTurn
            ? ['Déplacement ou pose de mur.']
            : ['Attendez votre tour.'],
          current: {
            playerId: userId,
            pawn: viewerPos,
          },
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

  private buildGridCellActions(exposed: GameStateWithActions): Record<string, any[]> {
    const result: Record<string, any[]> = {};
    const actions = (exposed.actions ?? []) as any[];
    for (const action of actions) {
      const payload = action?.payload ?? {};
      const x = payload?.x;
      const y = payload?.y;
      if (typeof x !== 'number' || typeof y !== 'number') {
        continue;
      }

      const k = `${x},${y}`;
      const type = String(action?.type ?? '').trim();
      const o = typeof payload?.o === 'string' ? String(payload.o).trim().toLowerCase() : '';
      const label =
        type === 'corridor_move'
          ? 'Déplacer ici'
          : type === 'corridor_place_wall' && o === 'h'
            ? 'Mur horizontal ici'
            : type === 'corridor_place_wall' && o === 'v'
              ? 'Mur vertical ici'
              : (action?.label ?? action?.type);
      (result[k] ??= []).push({
        type,
        label,
        payload,
      });
    }
    return result;
  }

  private buildBlockedEdges(meta: CorridorMetadata): Record<string, { n: boolean; e: boolean; s: boolean; w: boolean }> {
    const size = meta?.size ?? 0;
    const h = new Set((meta?.walls?.h ?? []).map((k) => String(k)));
    const v = new Set((meta?.walls?.v ?? []).map((k) => String(k)));

    const hasH = (x: number, y: number) => h.has(`${x},${y}`);
    const hasV = (x: number, y: number) => v.has(`${x},${y}`);

    const blocked: Record<string, { n: boolean; e: boolean; s: boolean; w: boolean }> = {};
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const south = y === size - 1 ? true : hasH(x, y) || hasH(x - 1, y);
        const north = y === 0 ? true : hasH(x, y - 1) || hasH(x - 1, y - 1);
        const east = x === size - 1 ? true : hasV(x, y) || hasV(x, y - 1);
        const west = x === 0 ? true : hasV(x - 1, y) || hasV(x - 1, y - 1);
        blocked[`${x},${y}`] = { n: north, e: east, s: south, w: west };
      }
    }
    return blocked;
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
        payload: { x: to.x, y: to.y },
      })),
      ...walls.map((w) => ({
        type: 'corridor_place_wall',
        payload: { x: w.x, y: w.y, o: w.o },
      })),
    ];
  }

  protected buildPendingState(): any {
    return null;
  }

  protected buildExtras(
    state: GameStateEntity,
    metadata: CorridorMetadata,
    currentPlayerId: number | null,
  ): Record<string, unknown> {
    const baseExtras = this.getBaseExtras(state);
    const id = typeof currentPlayerId === 'number' ? currentPlayerId : null;
    const pos = id != null ? CorridorRulebook.getPawnPos(metadata, id) : null;

    return {
      ...baseExtras,
      currentPlayerView: {
        id,
        username:
          id != null
            ? state.players?.find((p) => p?.id === id)?.username ?? ''
            : '',
        position:
          pos != null
            ? [`Votre pion : colonne ${pos.x + 1}, ligne ${pos.y + 1}.`]
            : [],
      },
    };
  }

  protected buildExtrasForUser(
    state: GameStateEntity,
    metadata: CorridorMetadata,
    userId: number,
    currentPlayerId: number | null,
  ): Record<string, unknown> {
    const baseExtras = this.getBaseExtras(state);
    const pos = CorridorRulebook.getPawnPos(metadata, userId);
    const isTurn = currentPlayerId === userId;
    const suffix = isTurn ? ' (à vous de jouer).' : '.';

    return {
      ...baseExtras,
      currentPlayerView: {
        id: userId,
        username: state.players?.find((p) => p?.id === userId)?.username ?? '',
        position: [
          `Votre pion : colonne ${pos.x + 1}, ligne ${pos.y + 1}${suffix}`,
        ],
      },
    };
  }
}
