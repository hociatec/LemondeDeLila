export type FouleesFantastiquesTile = {
    id: string;
    type: 'normal';
    label: string;
};
export type FouleesFantastiquesColor = 'Rouge' | 'Bleu' | 'Vert' | 'Jaune';
export type FouleesFantastiquesPawnState = {
    pawnIndex: number;
    progress: number;
};
export type FouleesFantastiquesMetadata = {
    tiles: FouleesFantastiquesTile[];
    trackLength: number;
    homeLength: number;
    pawnsByPlayer: Record<number, FouleesFantastiquesPawnState[]>;
    colorsByPlayer: Record<number, FouleesFantastiquesColor>;
    familyIdByPlayer?: Record<number, string>;
    familyByPlayer?: Record<number, string>;
    habitatByPlayer?: Record<number, string>;
    pawnNamesByPlayer?: Record<number, string[]>;
    offsets: Record<number, number>;
    safeTiles: number[];
    positions: Record<number, number>;
    laps: Record<number, number>;
    statuses: {
        skipTurn: Record<number, number>;
    };
    winnerId: number | null;
};
