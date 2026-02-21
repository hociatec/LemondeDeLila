import { Injectable } from '@nestjs/common';

@Injectable()
export class GridBlockedEdgesService {
  buildFromWalls(
    size: number,
    walls: { h?: string[]; v?: string[] } | null | undefined,
  ): Record<string, { n: boolean; e: boolean; s: boolean; w: boolean }> {
    const s = Number(size);
    if (!Number.isFinite(s) || s <= 0 || s > 50) {
      return {};
    }

    const h = new Set((walls?.h ?? []).map((k) => String(k)));
    const v = new Set((walls?.v ?? []).map((k) => String(k)));

    const hasH = (x: number, y: number) => h.has(`${x},${y}`);
    const hasV = (x: number, y: number) => v.has(`${x},${y}`);

    const blocked: Record<
      string,
      { n: boolean; e: boolean; s: boolean; w: boolean }
    > = {};

    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const south = y === s - 1 ? true : hasH(x, y) || hasH(x - 1, y);
        const north = y === 0 ? true : hasH(x, y - 1) || hasH(x - 1, y - 1);
        const east = x === s - 1 ? true : hasV(x, y) || hasV(x, y - 1);
        const west = x === 0 ? true : hasV(x - 1, y) || hasV(x - 1, y - 1);
        blocked[`${x},${y}`] = { n: north, e: east, s: south, w: west };
      }
    }

    return blocked;
  }
}
