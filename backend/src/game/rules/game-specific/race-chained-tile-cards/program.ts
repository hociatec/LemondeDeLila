import type { GameEffectInstruction } from '../../../engine/sdk/extension-contracts';

export type ChainedTileType = string;
export type ChainedTileRule = { description: string } & (
  | { kind: 'none' | 'finish' | 'choose-swap' | 'await-draw' }
  | { kind: 'move' | 'protected-move'; delta: number }
  | { kind: 'random-move'; maximum: number }
  | { kind: 'move-to'; position: number }
);

export type ChainedTileCard = {
  id: number;
  text: string;
  retreatScore: number;
  effects: readonly GameEffectInstruction[];
};
export type ChainedTileRaceProgram = {
  tileRules: Readonly<Record<string, ChainedTileRule>>;
  finishReason: string;
  selectionDrawCount: number;
  trackId: string;
  pawnSetId: string;
  pawnChoiceId: string;
  deckId: string;
  diceId: string;
  trapImmunityStatusId: string;
  awaitingCardStatusId: string;
  cards: readonly ChainedTileCard[];
  pawns: readonly { id: string; label: string; description: string }[];
  tiles: readonly {
    type: ChainedTileType;
    label: string;
    description?: string;
  }[];
  maxResolutionDepth: number;
};
