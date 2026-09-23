import type { EffectCard } from '../../../engine/runtime/contracts/effect-card';
import type { TrackRaceProgram } from '../../../engine/runtime/contracts/track-race-contract';

export type TreasureTrackDeckKind = string;

export type TreasureTrackRaceProgram = TrackRaceProgram & {
  tiles: readonly {
    n: number;
    title: string;
    description: string;
    type: string;
  }[];
  tileRules: Record<
    string,
    {
      kind: 'none' | 'draw' | 'gain' | 'finish';
      deck?: string;
      amount?: number;
    }
  >;
  deckRules: Record<string, { resolveEffects: boolean; protected: boolean }>;
  victoryCollection: string;
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
export type TreasureTrackRaceCard = EffectCard;
