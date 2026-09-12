/** Single-consumer JSON authoring extension; prefer shared effects and patterns for new rules. */
import type { GameEffectInstruction } from '../../contracts/effect-ir';
import type { TrackRaceProgram } from '../../contracts/track-race-contract';

export type MamanTileType =
  | 'start'
  | 'neutral'
  | 'token'
  | 'card'
  | 'bonds'
  | 'slide'
  | 'storm'
  | 'nest'
  | 'meeting'
  | 'finish';

export type MamanRaceProgram = TrackRaceProgram & {
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
    type: MamanTileType;
  }[];
  cards: readonly {
    id: number;
    text: string;
    effects: readonly GameEffectInstruction[];
  }[];
};
