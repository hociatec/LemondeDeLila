export type CorridorPos = {
    x: number;
    y: number;
};
export type CorridorWallOrientation = 'h' | 'v';
export type CorridorMetadata = {
    size: number;
    pawnsByPlayerId: Record<string, CorridorPos>;
    walls: {
        h: string[];
        v: string[];
    };
    wallsRemainingByPlayerId: Record<string, number>;
    winnerPlayerId?: number | null;
};
