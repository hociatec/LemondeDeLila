export type FouleesFantastiquesBoardJsonV1 = {
    version: 1;
    trackLength: number;
    homeLength: number;
    tiles: Array<{
        id?: string;
        label?: string;
    }>;
    safeTiles?: number[];
};
