import type { GameEffectInstruction } from '../../contracts/effect-ir';

export type ChainedTileType =
  | 'start'
  | 'neutral'
  | 'bonus'
  | 'folie'
  | 'piege'
  | 'glissade'
  | 'tornade'
  | 'chaton'
  | 'finish';

export type ChainedTileCard = {
  id: number;
  text: string;
  retreatScore: number;
  effects: readonly GameEffectInstruction[];
};
export type ChainedTileRaceProgram = {
  trackId: string;
  pawnSetId: string;
  pawnChoiceId: string;
  deckId: string;
  diceId: string;
  trapImmunityStatusId: string;
  awaitingCardStatusId: string;
  cards: readonly ChainedTileCard[];
  pawns: readonly { id: string; label: string; description: string }[];
  tiles: readonly { type: ChainedTileType; label: string }[];
  maxResolutionDepth: number;
};
