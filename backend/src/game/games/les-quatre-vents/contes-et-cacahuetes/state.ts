import type { ContesCard, ContesCardType } from './content';

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

export type ContesPendingEffect =
  | { kind: 'reroll'; actorId: number; roll: number }
  | {
      kind: 'target';
      actorId: number;
      effect: ContesTargetEffect;
      cardId?: number;
    }
  | {
      kind: 'option';
      actorId: number;
      effect: ContesOptionEffect;
      targetId?: number;
    }
  | {
      kind: 'laughter';
      actorId: number;
      order: number[];
      picks: Record<number, number>;
    }
  | { kind: 'abundance'; actorId: number; cards: ContesCard[] }
  | { kind: 'token'; actorId: number; targetId: number; tokens: string[] };

export interface ContesState {
  pawnByPlayerId: Record<number, string>;
  setupComplete: boolean;
  starterId: number;
  skipTurns: Record<number, number>;
  rerollTokens: Record<number, number>;
  shieldMalus: Record<number, number>;
  protectNextMalus: Record<number, boolean>;
  cape: Record<number, boolean>;
  replaceOne: Record<number, boolean>;
  noBonusTurns: Record<number, number>;
  forcedOneTurns: Record<number, number>;
  reverseNextTurn: Record<number, boolean>;
  blockedAt: Record<number, number | null>;
  turnReplacement: Record<number, number | null>;
  activeSlotOwnerId: number | null;
  keyOfGold: Record<number, boolean>;
  pendingEffect: ContesPendingEffect | null;
  queuedDraws: ContesCardType[];
  resolvingPlayerId: number | null;
  lastConte: {
    playerId: number;
    title: string;
    text: string;
    timestamp: string;
  } | null;
  winnerId: number | null;
}

export type ContesPlayerView = Omit<
  ContesState,
  'pendingEffect' | 'queuedDraws' | 'resolvingPlayerId' | 'activeSlotOwnerId'
> & {
  positions: Record<number, number>;
  deckCounts: Record<ContesCardType, number>;
};
