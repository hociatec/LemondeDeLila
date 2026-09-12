import type { GameEffectInstruction } from './effect-ir';

export type ContesCardType = 'bonus' | 'malus' | 'surprise' | 'conte';
export type ContesTileType =
  'start' | 'conte' | 'bonus' | 'malus' | 'surprise' | 'finish';
export type ContesTargetEffect =
  | 'move-other-two'
  | 'swap-next-turns'
  | 'give-bonus'
  | 'swap-positions'
  | 'steal-token'
  | 'travelling-book'
  | 'song-steal'
  | 'wish-swap'
  | 'gold-key';
export type ContesOptionEffect = 'song' | 'wish' | 'gold-key-type';

export type ContesCard = {
  id: number;
  type: ContesCardType;
  title: string;
  text: string;
  effects: readonly GameEffectInstruction[];
};

export type ContesProgram = {
  trackId: string;
  pawnSetId: string;
  pawnChoiceId: string;
  resolutionFlag: string;
  maxChainDepth: number;
  resources: { reroll: string; shield: string };
  statuses: {
    protectNextMalus: string;
    cape: string;
    replaceOne: string;
    noBonus: string;
    forcedOne: string;
    reverseNextTurn: string;
    blocked: string;
    keyOfGold: string;
  };
  tiles: readonly {
    id: string;
    type: ContesTileType;
    label: string;
    description: string;
  }[];
  pawns: readonly { id: string; label: string; description: string }[];
  decks: Readonly<Record<ContesCardType, readonly ContesCard[]>>;
};
