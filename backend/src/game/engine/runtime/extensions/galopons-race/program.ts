/** Single-consumer JSON authoring extension; prefer shared effects and patterns for new rules. */
import type { GameEffectInstruction } from '../../contracts/effect-ir';
import type { TrackRaceProgram } from '../../contracts/track-race-contract';

export type GaloponsRegion = 'prairie' | 'riviere' | 'foret' | 'montagne';

export type GaloponsRaceProgram = TrackRaceProgram & {
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
    region: GaloponsRegion;
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
