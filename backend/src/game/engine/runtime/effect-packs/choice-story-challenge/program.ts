import type { GameEffectInstruction } from '../../contracts/effect-ir';

export type StoryChallengeCardType = 'bonus' | 'malus' | 'surprise' | 'conte';
export type StoryChallengeTileType =
  'start' | 'conte' | 'bonus' | 'malus' | 'surprise' | 'finish';
export type StoryChallengeTargetEffect =
  | 'move-other-two'
  | 'swap-next-turns'
  | 'give-bonus'
  | 'swap-positions'
  | 'steal-token'
  | 'travelling-book'
  | 'song-steal'
  | 'wish-swap'
  | 'gold-key';
export type StoryChallengeOptionEffect = 'song' | 'wish' | 'gold-key-type';

export type StoryChallengeCard = {
  id: number;
  type: StoryChallengeCardType;
  title: string;
  text: string;
  effects: readonly GameEffectInstruction[];
};
export type StoryChallengeProgram = {
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
    type: StoryChallengeTileType;
    label: string;
    description: string;
  }[];
  pawns: readonly { id: string; label: string; description: string }[];
  decks: Readonly<
    Record<StoryChallengeCardType, readonly StoryChallengeCard[]>
  >;
};
