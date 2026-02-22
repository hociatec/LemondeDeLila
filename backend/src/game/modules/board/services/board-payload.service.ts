import { Injectable } from '@nestjs/common';
import { stringOrEmpty } from '@common/utils/string-value.utils';

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
    if (
      positionsRaw &&
      typeof positionsRaw === 'object' &&
      !Array.isArray(positionsRaw)
    ) {
      for (const [k, v] of Object.entries(
        positionsRaw as Record<string, unknown>,
      )) {
        const n =
          typeof v === 'number' ? v : Number.parseInt(stringOrEmpty(v), 10);
        if (!Number.isFinite(n)) continue;
        positions[String(k)] = Math.trunc(n);
      }
    }

    const laps: Record<string, number> = {};
    if (lapsRaw && typeof lapsRaw === 'object' && !Array.isArray(lapsRaw)) {
      for (const [k, v] of Object.entries(lapsRaw as Record<string, unknown>)) {
        const n =
          typeof v === 'number' ? v : Number.parseInt(stringOrEmpty(v), 10);
        if (!Number.isFinite(n)) continue;
        laps[String(k)] = Math.trunc(n);
      }
    }

    return Object.keys(laps).length > 0
      ? { tiles, positions, laps }
      : { tiles, positions };
  }

  buildPositionPanelMessage(params: {
    tilesRaw: unknown;
    positionsRaw: unknown;
    lapsRaw?: unknown;
    playerId: number | null;
  }): string {
    const playerId = params.playerId;
    if (typeof playerId !== 'number' || !Number.isFinite(playerId)) {
      return 'Position: inconnue.';
    }

    const board = this.buildTilesPositionsLaps(
      params.tilesRaw,
      params.positionsRaw,
      params.lapsRaw,
    );

    const totalTiles = board.tiles.length;
    const pos = board.positions[String(playerId)];
    if (!Number.isFinite(pos) || totalTiles <= 0) {
      return 'Position: inconnue.';
    }

    const caseNumber = Math.max(1, Math.trunc(pos) + 1);
    const lap = board.laps?.[String(playerId)];
    const tourPlateau = Number.isFinite(lap)
      ? String(Math.trunc(lap as number))
      : '?';
    return `Tour plateau ${tourPlateau}, case ${caseNumber}/${totalTiles}.`;
  }
}
