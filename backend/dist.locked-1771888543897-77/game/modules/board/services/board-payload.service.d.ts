export declare class BoardPayloadService {
    buildTilesPositionsLaps(tilesRaw: unknown, positionsRaw: unknown, lapsRaw?: unknown): {
        tiles: unknown[];
        positions: Record<string, number>;
        laps?: Record<string, number>;
    };
    buildPositionPanelMessage(params: {
        tilesRaw: unknown;
        positionsRaw: unknown;
        lapsRaw?: unknown;
        playerId: number | null;
    }): string;
}
