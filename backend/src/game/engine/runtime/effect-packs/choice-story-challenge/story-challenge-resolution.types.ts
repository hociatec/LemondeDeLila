import type {
  StoryChallengeCardType,
  StoryChallengeOptionEffect,
} from './program';

export type StoryChallengePendingResolution =
  | { kind: 'reroll'; actorId: number; roll: number }
  | {
      kind: 'option';
      actorId: number;
      effect: StoryChallengeOptionEffect;
      targetId?: number;
    }
  | {
      kind: 'laughter';
      actorId: number;
      order: number[];
      picks: Record<number, number>;
    }
  | { kind: 'abundance'; actorId: number; cardIds: number[] }
  | { kind: 'token'; actorId: number; targetId: number; tokens: string[] };

export type StoryChallengeDrawResolution = {
  playerId: number;
  types: StoryChallengeCardType[];
};
