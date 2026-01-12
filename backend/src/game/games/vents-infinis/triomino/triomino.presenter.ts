import { Injectable } from '@nestjs/common';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import { BasePresenterService } from '../../../engine/abstract/base-presenter.service';
import { GridCellActionsService } from '../../../modules/grid/services/grid-cell-actions.service';
import type { TriominoMetadata, TriominoTile } from './model/triomino.model';
import { isUpTriangle, triominoKey } from './model/triomino.model';

@Injectable()
export class TriominoPresenter extends BasePresenterService {
  constructor(private readonly gridCellActions: GridCellActionsService) {
    super();
  }

  exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions {
    const meta = (state.metadata ?? {}) as TriominoMetadata;
    const exposed = this.buildExposedStateForUser(state, userId);

    if (!this.isStarted(state)) {
      return exposed;
    }

    const size = Number(meta.size ?? 0);
    if (!size || size <= 0) return exposed;

    const entities: any[] = [];
    for (const [key, placement] of Object.entries(meta.placedByKey ?? {})) {
      const [xs, ys] = key.split(',');
      const x = Number(xs);
      const y = Number(ys);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const tile = placement?.tile as TriominoTile;
      if (!tile) continue;
      const glyph = `${tile.a}-${tile.b}-${tile.c}`;
      entities.push({
        id: `t:${tile.id}`,
        type: 'tile',
        ownerId: placement.ownerId ?? null,
        x,
        y,
        glyph,
      });
    }

    const cellActions = this.gridCellActions.buildFromActions(
      exposed.actions ?? [],
      (a) => {
        const type = String((a as any)?.type ?? '').trim();
        const payload = (a as any)?.payload ?? {};
        if (type === 'triomino_place') {
          const rot = typeof payload?.rot === 'number' ? payload.rot : null;
          return rot == null ? 'Placer' : `Placer (rotation ${rot})`;
        }
        return String((a as any)?.label ?? 'Action');
      },
    );

    const tags: Record<string, string[]> = {};
    for (const key of Object.keys(cellActions)) {
      tags[key] = ['Possible'];
    }

    const currentPlayerId = state.turn?.currentPlayerId ?? null;
    const selectedId = (meta.selectedTileIdByPlayerId ?? {})[String(userId)] ?? null;
    const winnerId = (meta as any)?.winnerId ?? null;

    const statusLines: string[] = [];
    if (winnerId) {
      statusLines.push(`Gagnant : ${state.players?.find((p) => p?.id === winnerId)?.username ?? `#${winnerId}`}`);
    } else if (selectedId) {
      statusLines.push(`Triomino sélectionné (#${selectedId}) : placez-le sur la grille.`);
      statusLines.push('Échap : annuler.');
    } else {
      statusLines.push(currentPlayerId === userId ? 'À vous de jouer.' : "Tour de l'adversaire.");
    }

    return {
      ...exposed,
      extras: {
        ...(exposed.extras ?? {}),
        grid: {
          kind: 'grid',
          size,
          entities,
          cellActions,
          cellTags: tags,
          statusLines,
        },
      },
      board: {
        tiles: Array.from({ length: size * size }, (_, i) => ({
          x: i % size,
          y: Math.floor(i / size),
          kind: isUpTriangle(i % size, Math.floor(i / size)) ? 'up' : 'down',
        })),
      },
    } as any;
  }

  protected buildCatalog(): { phases: string[]; victory: any } {
    return { phases: ['play'], victory: { type: 'highest_score' } };
  }

  protected getAvailableActionsForUser(
    state: GameStateEntity,
    userId: number,
  ): GameSingleActionDto[] {
    if (!this.isStarted(state)) return [];
    const meta = (state.metadata ?? {}) as TriominoMetadata;
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== userId) return [];
    if ((meta.winnerId ?? null) != null) return [];

    const selectedTileId = (meta.selectedTileIdByPlayerId ?? {})[String(userId)] ?? null;
    if (selectedTileId) {
      // While a tile is selected: expose placement actions on the grid.
      return (meta as any).legalPlacementActionsByPlayerId?.[String(userId)] ?? [];
    }

    const hand = (meta.handsByPlayerId ?? {})[String(userId)] ?? [];
    const out: GameSingleActionDto[] = [];
    // These actions are aligned with pending choices; they don't need x/y.
    for (const tile of hand) {
      out.push({ type: 'triomino_select_tile', payload: { tileId: tile.id } });
    }
    if ((meta.deck ?? []).length > 0) out.push({ type: 'draw', payload: {} });
    out.push({ type: 'triomino_pass', payload: {} });
    return out;
  }

  protected buildPendingState(
    _state: GameStateEntity,
    _metadata: TriominoMetadata,
    _currentPlayerId: number | null,
  ): any {
    return null;
  }

  protected buildPendingStateForUser(
    state: GameStateEntity,
    metadata: TriominoMetadata,
    userId: number,
    currentPlayerId: number | null,
  ): any {
    if (!this.isStarted(state)) return null;
    if (currentPlayerId !== userId) return null;
    if ((metadata.winnerId ?? null) != null) return null;

    const selectedTileId = (metadata.selectedTileIdByPlayerId ?? {})[String(userId)] ?? null;
    if (selectedTileId) return null;

    const hand = (metadata.handsByPlayerId ?? {})[String(userId)] ?? [];
    const choices: string[] = [];
    for (const t of hand) {
      choices.push(`#${t.id} ${t.a}-${t.b}-${t.c}`);
    }
    if ((metadata.deck ?? []).length > 0) choices.push('Piocher');
    choices.push('Passer');

    const score = Number((metadata.scoresByPlayerId ?? {})[String(userId)] ?? 0);
    return {
      type: 'triomino_turn',
      label: `Choisissez un triomino. Score: ${score}. Pioche: ${(metadata.deck ?? []).length}.`,
      playerId: userId,
      choices,
    };
  }

  protected getActionLabel(actionType: string): string {
    if (actionType === 'triomino_select_tile') return 'Sélectionner';
    if (actionType === 'triomino_place') return 'Placer';
    if (actionType === 'draw') return 'Piocher';
    if (actionType === 'triomino_pass') return 'Passer';
    if (actionType === 'triomino_cancel') return 'Annuler';
    return actionType;
  }

  protected buildExtras(
    state: GameStateEntity,
    _metadata: TriominoMetadata,
    _currentPlayerId: number | null,
  ): Record<string, unknown> {
    return this.getBaseExtras(state);
  }

  protected buildExtrasForUser(
    state: GameStateEntity,
    metadata: TriominoMetadata,
    userId: number,
    currentPlayerId: number | null,
  ): Record<string, unknown> {
    const base = this.getBaseExtras(state);
    const players = Array.isArray(state.players) ? state.players : [];

    const handTiles = ((metadata.handsByPlayerId ?? {})[String(userId)] ?? []) as TriominoTile[];
    const hand = handTiles.map((t) => `#${t.id} ${t.a}-${t.b}-${t.c}`);

    const scoreBy = metadata.scoresByPlayerId ?? {};
    const myScore = Number(scoreBy[String(userId)] ?? 0);
    const scoreLines = players
      .filter((p) => p?.id)
      .map((p) => {
        const pid = p.id;
        const name = p.username ?? `#${pid}`;
        const s = Number(scoreBy[String(pid)] ?? 0);
        return `${name}: ${s}`;
      });

    const deckCount = (metadata.deck ?? []).length;
    const placedCount = Object.keys(metadata.placedByKey ?? {}).length;

    const selectedId = (metadata.selectedTileIdByPlayerId ?? {})[String(userId)] ?? null;
    const placements = (metadata as any).legalPlacementActionsByPlayerId?.[String(userId)] ?? [];
    const placementCount = Array.isArray(placements) ? placements.length : 0;

    const positionMessage = `Posées: ${placedCount}. Pioche: ${deckCount}. Main: ${hand.length}. Score: ${myScore}.`;
    const playMessage = (() => {
      if (!this.isStarted(state)) return 'Partie non démarrée.';
      if (currentPlayerId !== userId) return "Ce n'est pas votre tour.";
      if ((metadata.winnerId ?? null) != null) return 'Partie terminée.';
      if (selectedId) {
        return `Triomino sélectionné (#${selectedId}). Placements possibles: ${placementCount}. Entrée: placer sur la grille. Échap: annuler.`;
      }
      return `Sélectionnez un triomino (liste) puis placez-le sur la grille.`;
    })();

    return {
      ...base,
      hand,
      score: [`Total: ${myScore}`, ...scoreLines],
      ui: {
        panels: {
          hand: {
            title: 'Main',
            message: hand.length ? `Main: ${hand.join(', ')}` : 'Main: (vide)',
          },
          score: {
            title: 'Score',
            message: scoreLines.length ? `Score: ${scoreLines.join(', ')}` : 'Score: inconnu.',
          },
          position: {
            title: 'Position',
            message: positionMessage,
          },
          play: {
            title: 'À jouer',
            message: playMessage,
          },
          table: {
            title: 'Table',
            message: `Raccourcis: C=main, P=position, S=score, A=à jouer.`,
          },
        },
      },
    };
  }
}
