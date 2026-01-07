export type JeuOieTile =
  | { id: string; type: 'start'; label: string }
  | { id: string; type: 'goose'; label: string }
  | { id: string; type: 'bridge'; label: string }
  | { id: string; type: 'inn'; label: string; skipTurns: number }
  | { id: string; type: 'labyrinth'; label: string; backTo: number }
  | { id: string; type: 'prison'; label: string; skipTurns: number }
  | { id: string; type: 'death'; label: string; backTo: number }
  | { id: string; type: 'normal'; label: string }
  | { id: string; type: 'finish'; label: string };

export type JeuOieMetadata = {
  tiles: JeuOieTile[];
  positions: Record<number, number>;
  laps: Record<number, number>;
  statuses: {
    skipTurn: Record<number, number>;
  };
  winnerId: number | null;
};
