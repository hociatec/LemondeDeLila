type JeuOieTileBase = { id: string; label: string; description?: string };

export type JeuOieTile =
  | (JeuOieTileBase & { type: 'start' })
  | (JeuOieTileBase & { type: 'goose' })
  | (JeuOieTileBase & { type: 'bridge' })
  | (JeuOieTileBase & { type: 'inn'; skipTurns: number })
  | (JeuOieTileBase & { type: 'labyrinth'; backTo: number })
  | (JeuOieTileBase & { type: 'prison'; skipTurns: number })
  | (JeuOieTileBase & { type: 'death'; backTo: number })
  | (JeuOieTileBase & { type: 'normal' })
  | (JeuOieTileBase & { type: 'finish' });

export type JeuOieMetadata = {
  tiles: JeuOieTile[];
  positions: Record<number, number>;
  laps: Record<number, number>;
  statuses: {
    skipTurn: Record<number, number>;
  };
  winnerId: number | null;
};
