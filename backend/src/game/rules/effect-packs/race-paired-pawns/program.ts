import type { GameEffectInstruction } from '../../../engine/runtime/contracts/effect-ir';
import type { TrackRaceProgram } from '../../../engine/runtime/contracts/track-race-contract';

export type PairedPawnTileType = string;

export type PairedPawnRaceProgram = TrackRaceProgram & {
  tileRules: Readonly<
    Record<
      string,
      {
        kind: 'none' | 'gain' | 'draw' | 'move' | 'skip' | 'meeting' | 'finish';
        amount: number;
      }
    >
  >;
  transferAmount: number;
  sharedAdvance: number;
  meetingAdvance: number;
  rollMinimum: number;
  rollAdvance: number;
  deckId: string;
  tokenResource: string;
  bonusRerollStatus: string;
  tokensToWin: number;
  maxDepth: number;
  eventNamespace: string;
  tiles: readonly {
    id: number;
    title: string;
    description?: string;
    type: PairedPawnTileType;
  }[];
  cards: readonly {
    id: number;
    text: string;
    effects: readonly GameEffectInstruction[];
  }[];
};
