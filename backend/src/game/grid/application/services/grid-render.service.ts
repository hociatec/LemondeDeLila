import { Injectable } from '@nestjs/common';
import { GameStateWithActions } from '../../../core/application/models/game-action.model';

type GridBlockedEdges = Record<
  string,
  { n?: boolean; e?: boolean; s?: boolean; w?: boolean }
>;
type GridRenderBorder = { l: number; t: number; r: number; b: number };
type GridRenderCell = {
  walls: { n: boolean; e: boolean; s: boolean; w: boolean };
  border: GridRenderBorder;
};
type GridExtras = {
  size?: number | string;
  blockedEdges?: GridBlockedEdges;
  render?: { cells: Record<string, GridRenderCell>; thick: number };
};

@Injectable()
export class GridRenderService {
  attachGridRenderDescriptors(
    state: GameStateWithActions,
  ): GameStateWithActions {
    const extras =
      state.extras && typeof state.extras === 'object' ? state.extras : {};

    const gridExisting =
      'grid' in extras ? (extras.grid as unknown) : undefined;
    if (
      !gridExisting ||
      typeof gridExisting !== 'object' ||
      Array.isArray(gridExisting)
    ) {
      return state;
    }

    const grid = { ...(gridExisting as GridExtras) };
    if (grid.render !== undefined) {
      return state;
    }

    const blockedEdges = grid.blockedEdges;
    if (
      !blockedEdges ||
      typeof blockedEdges !== 'object' ||
      Array.isArray(blockedEdges)
    ) {
      return state;
    }

    const sizeRaw = grid.size;
    const size =
      typeof sizeRaw === 'number'
        ? sizeRaw
        : typeof sizeRaw === 'string'
          ? Number.parseInt(sizeRaw, 10)
          : NaN;
    if (!Number.isFinite(size) || size <= 0 || size > 50) {
      return state;
    }

    const thick = 4;
    const cells: Record<string, GridRenderCell> = {};

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const key = `${x},${y}`;
        const edges = blockedEdges[key];
        const isObj =
          edges && typeof edges === 'object' && !Array.isArray(edges);

        const nBlocked = isObj && edges.n === true;
        const eBlocked = isObj && edges.e === true;
        const sBlocked = isObj && edges.s === true;
        const wBlocked = isObj && edges.w === true;

        // Ne pas annoncer les bords (seulement les murs internes).
        const n = nBlocked && y > 0;
        const s = sBlocked && y < size - 1;
        const w = wBlocked && x > 0;
        const e = eBlocked && x < size - 1;

        cells[key] = {
          walls: { n, e, s, w },
          border: {
            l: w ? thick : 1,
            t: n ? thick : 1,
            r: e ? thick : 1,
            b: s ? thick : 1,
          },
        };
      }
    }

    grid.render = { cells, thick };

    return {
      ...state,
      extras: {
        ...extras,
        grid,
      },
    };
  }
}
