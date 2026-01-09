import { Injectable } from '@nestjs/common';

@Injectable()
export class BoardPayloadService {
  buildTilesPositionsLaps(
    tilesRaw: unknown,
    positionsRaw: unknown,
    lapsRaw?: unknown,
  ): {
    tiles: unknown[];
    positions: Record<string, number>;
    laps?: Record<string, number>;
  } {
    const tiles = Array.isArray(tilesRaw) ? tilesRaw : [];

    const positions: Record<string, number> = {};
    if (positionsRaw && typeof positionsRaw === 'object' && !Array.isArray(positionsRaw)) {
      for (const [k, v] of Object.entries(positionsRaw as Record<string, unknown>)) {
        const n = typeof v === 'number' ? v : Number.parseInt(String(v ?? ''), 10);
        if (!Number.isFinite(n)) continue;
        positions[String(k)] = Math.trunc(n);
      }
    }

    const laps: Record<string, number> = {};
    if (lapsRaw && typeof lapsRaw === 'object' && !Array.isArray(lapsRaw)) {
      for (const [k, v] of Object.entries(lapsRaw as Record<string, unknown>)) {
        const n = typeof v === 'number' ? v : Number.parseInt(String(v ?? ''), 10);
        if (!Number.isFinite(n)) continue;
        laps[String(k)] = Math.trunc(n);
      }
    }

    return Object.keys(laps).length > 0 ? { tiles, positions, laps } : { tiles, positions };
  }
}

