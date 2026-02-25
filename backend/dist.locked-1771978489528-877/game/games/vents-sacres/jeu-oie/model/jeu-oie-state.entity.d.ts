type JeuOieTileBase = {
    id: string;
    label: string;
    description?: string;
};
export type JeuOiePawn = {
    id: string;
    label: string;
    feminine: boolean;
};
export type JeuOieTile = (JeuOieTileBase & {
    type: 'start';
}) | (JeuOieTileBase & {
    type: 'goose';
}) | (JeuOieTileBase & {
    type: 'bridge';
}) | (JeuOieTileBase & {
    type: 'inn';
    skipTurns: number;
}) | (JeuOieTileBase & {
    type: 'magic_die';
}) | (JeuOieTileBase & {
    type: 'labyrinth';
    backTo: number;
}) | (JeuOieTileBase & {
    type: 'prison';
    skipTurns: number;
}) | (JeuOieTileBase & {
    type: 'death';
    backTo: number;
}) | (JeuOieTileBase & {
    type: 'well';
}) | (JeuOieTileBase & {
    type: 'normal';
}) | (JeuOieTileBase & {
    type: 'finish';
});
export type JeuOieMetadata = {
    tiles: JeuOieTile[];
    positions: Record<number, number>;
    laps: Record<number, number>;
    pawns: JeuOiePawn[];
    pawnByPlayerId: Record<number, string>;
    setupStarterId?: number | null;
    statuses: {
        skipTurn: Record<number, number>;
        well: Record<number, boolean>;
    };
    winnerId: number | null;
};
export {};
