import type { GameEffectInstruction } from './effect-ir';

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

export type MamanRaceProgram = {
  trackId: string;
  diceId: string;
  deckId: string;
  tokenResource: string;
  bonusRerollStatus: string;
  tokensToWin: number;
  maxDepth: number;
  finishReason: string;
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
