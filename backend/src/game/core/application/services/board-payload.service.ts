import { Injectable } from '@nestjs/common';
import { stringOrEmpty } from '@common/utils/public-api';

@Injectable()
export class BoardPayloadService {
  private buildPlayerNameMap(playersRaw: unknown): Map<number, string> {
    const players = Array.isArray(playersRaw) ? playersRaw : [];
    const namesById = new Map<number, string>();
    for (const player of players) {
      if (!player || typeof player !== 'object') continue;
      const record = player as Record<string, unknown>;
      const id =
        typeof record.id === 'number'
          ? record.id
          : Number.parseInt(stringOrEmpty(record.id), 10);
      if (!Number.isFinite(id) || id === 0) continue;
      const username = stringOrEmpty(record.username).trim();
      namesById.set(id, username.length > 0 ? username : `Joueur ${id}`);
    }
    return namesById;
  }

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
    playersRaw?: unknown;
  }): string {
    const board = this.buildTilesPositionsLaps(
      params.tilesRaw,
      params.positionsRaw,
      params.lapsRaw,
    );

    const totalTiles = board.tiles.length;
    if (totalTiles <= 0 || Object.keys(board.positions).length === 0) {
      return 'Positions: inconnues.';
    }

    const namesById = this.buildPlayerNameMap(params.playersRaw);

    const formatLine = (id: string, position: number): string => {
      const caseNumber = Math.max(1, Math.trunc(position) + 1);
      const lap = board.laps?.[id];
      const tourPlateau = Number.isFinite(lap)
        ? String(Math.trunc(lap as number))
        : '?';
      return `Tour plateau ${tourPlateau}, case ${caseNumber}/${totalTiles}.`;
    };

    const allPlayers: Array<{ id: number; line: string }> = [];
    const allPlayerIds = new Set<number>();
    for (const rawId of Object.keys(board.positions)) {
      const pid = Number.parseInt(rawId, 10);
      if (!Number.isFinite(pid) || pid === 0) continue;
      allPlayerIds.add(pid);
    }
    for (const pid of namesById.keys()) {
      if (Number.isFinite(pid) && pid !== 0) {
        allPlayerIds.add(pid);
      }
    }

    for (const pid of allPlayerIds) {
      const rawId = String(pid);
      const rawPos = board.positions[rawId];
      if (!Number.isFinite(pid) || pid === 0) continue;
      const name = namesById.get(pid) ?? `Joueur ${pid}`;
      allPlayers.push({
        id: pid,
        line: Number.isFinite(rawPos)
          ? `${name} : ${formatLine(rawId, rawPos)}`
          : `${name} : position inconnue.`,
      });
    }
    allPlayers.sort((a, b) => a.id - b.id);

    if (allPlayers.length === 0) {
      return 'Positions: inconnues.';
    }

    return `Positions. ${allPlayers.map((player) => player.line).join(' ')}`;
  }

  buildPawnProgressPositionPanelMessage(params: {
    playersRaw: unknown;
    pawnsByPlayerRaw: unknown;
    trackLengthRaw: unknown;
    homeLengthRaw?: unknown;
    offsetsRaw?: unknown;
    pawnNamesByPlayerRaw?: unknown;
    stableLabel?: string;
    homeLabel?: string;
    arrivedLabel?: string;
    trackLabel?: string;
  }): string {
    const namesById = this.buildPlayerNameMap(params.playersRaw);
    const pawnsByPlayer =
      params.pawnsByPlayerRaw &&
      typeof params.pawnsByPlayerRaw === 'object' &&
      !Array.isArray(params.pawnsByPlayerRaw)
        ? (params.pawnsByPlayerRaw as Record<string, unknown>)
        : {};
    const offsets =
      params.offsetsRaw &&
      typeof params.offsetsRaw === 'object' &&
      !Array.isArray(params.offsetsRaw)
        ? (params.offsetsRaw as Record<string, unknown>)
        : {};
    const pawnNamesByPlayer =
      params.pawnNamesByPlayerRaw &&
      typeof params.pawnNamesByPlayerRaw === 'object' &&
      !Array.isArray(params.pawnNamesByPlayerRaw)
        ? (params.pawnNamesByPlayerRaw as Record<string, unknown>)
        : {};

    const trackLength = Number(params.trackLengthRaw);
    const homeLength = Number(params.homeLengthRaw ?? 0);
    if (!Number.isFinite(trackLength) || trackLength <= 0) {
      return 'Positions: inconnues.';
    }

    const totalPawnsByPlayer = new Map<number, number>();
    const playerIds = new Set<number>();
    for (const [rawId, rawPawns] of Object.entries(pawnsByPlayer)) {
      const id = Number.parseInt(rawId, 10);
      if (!Number.isFinite(id) || id === 0) continue;
      if (!Array.isArray(rawPawns)) continue;
      playerIds.add(id);
      totalPawnsByPlayer.set(id, rawPawns.length);
    }
    for (const id of namesById.keys()) {
      playerIds.add(id);
    }

    if (playerIds.size === 0) {
      return 'Positions: inconnues.';
    }

    const arrivalProgress =
      Number.isFinite(homeLength) && homeLength > 0
        ? trackLength + homeLength - 1
        : null;
    const stableLabel = params.stableLabel?.trim() || 'Depart';
    const homeLabel = params.homeLabel?.trim() || 'Abri';
    const arrivedLabel = params.arrivedLabel?.trim() || 'Arrivee';
    const trackLabel = params.trackLabel?.trim() || 'Piste';

    const lines = [...playerIds]
      .sort((a, b) => a - b)
      .map((playerId) => {
        const name = namesById.get(playerId) ?? `Joueur ${playerId}`;
        const rawPawns = pawnsByPlayer[String(playerId)];
        const pawns = Array.isArray(rawPawns) ? rawPawns : [];
        const totalPawns =
          totalPawnsByPlayer.get(playerId) ??
          (pawns.length > 0 ? pawns.length : 4);
        const rawOffset = offsets[String(playerId)];
        const offset = Number.isFinite(Number(rawOffset))
          ? Math.trunc(Number(rawOffset))
          : 0;
        const rawPawnNames = pawnNamesByPlayer[String(playerId)];
        const pawnNames = Array.isArray(rawPawnNames) ? rawPawnNames : [];

        let stableCount = 0;
        let homeCount = 0;
        let arrivedCount = 0;
        const trackParts: string[] = [];

        for (const pawn of pawns) {
          if (!pawn || typeof pawn !== 'object') continue;
          const record = pawn as Record<string, unknown>;
          const progress = Number(record.progress);
          if (!Number.isFinite(progress)) continue;

          if (progress < 0) {
            stableCount += 1;
            continue;
          }

          if (arrivalProgress != null && progress >= arrivalProgress) {
            arrivedCount += 1;
            continue;
          }

          if (arrivalProgress != null && progress >= trackLength) {
            homeCount += 1;
            continue;
          }

          const pawnIndex = Number(record.pawnIndex);
          const defaultPawnLabel = Number.isFinite(pawnIndex)
            ? `Pion ${Math.trunc(pawnIndex) + 1}`
            : 'Pion';
          const namedPawn =
            Number.isFinite(pawnIndex) &&
            typeof pawnNames[Math.trunc(pawnIndex)] === 'string'
              ? stringOrEmpty(pawnNames[Math.trunc(pawnIndex)]).trim()
              : '';
          const pawnLabel = namedPawn || defaultPawnLabel;
          const boardPos = ((offset + Math.trunc(progress)) % trackLength) + 1;
          trackParts.push(`${pawnLabel} case ${boardPos}/${trackLength}`);
        }

        const parts = [
          `${stableLabel} ${stableCount}/${totalPawns}`,
          `${homeLabel} ${homeCount}/${totalPawns}`,
          `${arrivedLabel} ${arrivedCount}/${totalPawns}`,
          `${trackLabel} ${trackParts.length ? trackParts.join(', ') : 'aucun pion sorti'}`,
        ];
        return `${name} : ${parts.join(', ')}.`;
      });

    return `Positions. ${lines.join(' ')}`;
  }
}
