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

    return {
      ...exposed,
      extras: {
        ...(exposed.extras ?? {}),
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

