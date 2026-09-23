import type { GameEffectInstruction } from '../../../engine/runtime/contracts/effect-ir';

export type StoryChallengeCardType = string;
export type StoryChallengeTileType = string;
export type StoryChallengeTargetEffect = string;
export type StoryChallengeOptionEffect = string;
export type StoryTargetRule =
  | { kind: 'move' | 'follow'; delta: number }
  | { kind: 'swap-turns' | 'swap-positions' | 'steal-token' }
  | { kind: 'give-card'; deck: string }
  | { kind: 'option'; optionId: string };
export type StoryOptionRule = { id: string } & (
  | { kind: 'move'; delta: number }
  | { kind: 'target'; effect: string }
  | {
      kind: 'draw';
      deck: string;
      target: 'actor' | 'selected';
      consumeStatus?: string;
    }
);
export type StoryChallengeCard = {
  id: number;
  type: StoryChallengeCardType;
  title: string;
  text: string;
  effects: readonly GameEffectInstruction[];
};
export type StoryChallengeProgram = {
  finishReason: string;
  diceId: string;
  deckRoles: { reward: string; penalty: string; event: string; story: string };
  tokens: readonly ({ id: string } & (
    { resource: string } | { status: string }
  ))[];
  targetRules: Readonly<Record<string, StoryTargetRule>>;
  optionRules: Readonly<Record<string, readonly StoryOptionRule[]>>;
  giftTargetEffect: string;
  conditionalTargetEffect: string;
  numberOptions: readonly number[];
  numberAdvance: number;
  choiceDrawCount: number;
  randomDrawDecks: readonly string[];
  randomDrawCount: number;
  forcedRoll: number;
  replacementRoll: number;
  lowRollThreshold: number;
  protectionAdvance: number;
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
