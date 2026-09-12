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
  turnsToSkip?: number;
  backTo?: number;
};

export type GooseRaceProgram = {
  trackId: string;
  diceId: string;
  playingPhase: string;
  wellStatus: string;
  finishReason: string;
  maxDepth: number;
  bridgeDestination: number;
  tiles: readonly GooseTile[];
  pawnSelection: { setId: string; choiceId: string };
};
