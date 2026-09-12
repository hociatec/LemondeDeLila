import type { GameEffectInstruction } from './effect-ir';

export type BalloonTileType =
  | 'start'
  | 'neutral'
  | 'bonus'
  | 'folie'
  | 'piege'
  | 'glissade'
  | 'tornade'
  | 'chaton'
  | 'finish';

export type BalloonCard = {
  id: number;
  text: string;
  retreatScore: number;
  effects: readonly GameEffectInstruction[];
};

export type BalloonRaceProgram = {
  trackId: string;
  pawnSetId: string;
  pawnChoiceId: string;
  deckId: string;
  diceId: string;
  trapImmunityStatusId: string;
  awaitingCardStatusId: string;
  cards: readonly BalloonCard[];
  pawns: readonly { id: string; label: string; description: string }[];
  tiles: readonly { type: BalloonTileType; label: string }[];
  maxResolutionDepth: number;
};
