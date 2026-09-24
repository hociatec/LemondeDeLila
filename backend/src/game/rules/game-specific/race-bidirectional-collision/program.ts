import type { GameEffectInstruction } from '../../../engine/sdk/extension-contracts';
import type { TrackRaceProgram } from '../../../engine/sdk/extension-contracts';

export type BidirectionalCollisionRegion = string;

export type BidirectionalCollisionRaceProgram = TrackRaceProgram & {
  deckId: string;
  pawnSetId: string;
  pawnChoiceId: string;
  appleResource: string;
  iouPrefix: string;
  returningStatus: string;
  applesToWin: number;
  maxDepth: number;
  tiles: readonly {
    n: number;
    type: 'start' | 'neutral' | 'card' | 'bonus' | 'skip' | 'finish';
    region: BidirectionalCollisionRegion;
    apples?: number;
    skipTurns?: number;
    [key: string]: unknown;
  }[];
  cards: readonly {
    id: number;
    text: string;
    effects: readonly GameEffectInstruction[];
  }[];
};
