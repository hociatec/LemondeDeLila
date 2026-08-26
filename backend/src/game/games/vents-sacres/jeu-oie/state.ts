export type GooseTile = {
  id: string;
  label: string;
  description?: string;
  type:
    | 'start'
    | 'goose'
    | 'bridge'
    | 'inn'
    | 'magic-die'
    | 'labyrinth'
    | 'prison'
    | 'death'
    | 'well'
    | 'normal'
    | 'finish';
  skipTurns?: number;
  backTo?: number;
};

export type GoosePawn = { id: string; label: string; feminine: boolean };

export interface JeuOieState {
  pawnByPlayerId: Record<number, string>;
  selectionOrder: number[];
  selectionIndex: number;
  setupComplete: boolean;
  skipTurns: Record<number, number>;
  inWell: Record<number, boolean>;
  lastRoll: number | null;
  winnerId: number | null;
}

export type JeuOiePlayerView = Omit<
  JeuOieState,
  'selectionOrder' | 'selectionIndex'
> & { positions: Record<number, number> };
