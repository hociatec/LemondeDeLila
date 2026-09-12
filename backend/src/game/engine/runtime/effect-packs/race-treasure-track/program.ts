import type { GameEffectInstruction } from '../../contracts/effect-ir';
import type { TrackRaceProgram } from '../../contracts/track-race-contract';

export type TreasureTrackDeckKind = 'treasure' | 'obstacle' | 'bonus';

export type TreasureTrackRaceProgram = TrackRaceProgram & {
  tiles: readonly {
    n: number;
    title: string;
    description: string;
    type:
      | 'start'
      | 'neutral'
      | 'bonus'
      | 'treasure'
      | 'obstacle'
      | 'gold'
      | 'finish';
  }[];
  decks: Record<TreasureTrackDeckKind, string>;
  inventories: Record<TreasureTrackDeckKind, string>;
  goldResource: string;
  obstacleImmunityStatus: string;
  collectionLimit: number;
  requiredTreasures: number;
  requiredGold: number;
  retreatSpaces: number;
  stealEffectId: string;
  eventNamespace: string;
};
export type TreasureTrackRaceCard = {
  id: string | number;
  effects: readonly GameEffectInstruction[];
};
