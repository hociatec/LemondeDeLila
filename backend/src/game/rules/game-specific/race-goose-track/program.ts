import type { TrackRaceProgram } from '../../../engine/sdk/extension-contracts';

export type GooseTile = {
  id: string;
  label: string;
  description?: string;
  type: string;
  turnsToSkip?: number;
  backTo?: number;
};
export type GooseRaceProgram = TrackRaceProgram & {
  tileRules: Readonly<
    Record<
      string,
      | 'none'
      | 'finish'
      | 'move-to'
      | 'return'
      | 'skip'
      | 'roll-directed'
      | 'block'
      | 'repeat-roll'
    >
  >;
  escapeRolls: readonly number[];
  forwardRollMaximum: number;
  defaultReturn: number;
  defaultSkip: number;
  playingPhase: string;
  wellStatus: string;
  maxDepth: number;
  bridgeDestination: number;
  tiles: readonly GooseTile[];
  pawnSelection: { setId: string; choiceId: string };
};
