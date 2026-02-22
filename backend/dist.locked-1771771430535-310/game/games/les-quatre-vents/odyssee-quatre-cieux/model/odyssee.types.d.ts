export type OdysseePawnState = {
    pawnIndex: number;
    progress: number;
};
export type OdysseeMetadata = {
    trackLength: number;
    homeLength: number;
    offsets: Record<number, number>;
    safeTiles: number[];
    pawnsByPlayer: Record<number, OdysseePawnState[]>;
    winnerId?: number | null;
};
