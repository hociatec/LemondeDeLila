import type { TrackRaceProgram } from '../../contracts/track-race-contract';

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
export type GooseRaceProgram = TrackRaceProgram & {
  playingPhase: string;
  wellStatus: string;
  maxDepth: number;
  bridgeDestination: number;
  tiles: readonly GooseTile[];
  pawnSelection: { setId: string; choiceId: string };
};
