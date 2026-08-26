import type { PlayerMap } from '../../../core/application/public-api';

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
      kind: 'option';
      actorId: number;
      effect: ContesOptionEffect;
      targetId?: number;
    }
  | {
      kind: 'laughter';
      actorId: number;
      order: number[];
      picks: PlayerMap<number>;
    }
  | { kind: 'abundance'; actorId: number; cardIds: number[] }
  | { kind: 'token'; actorId: number; targetId: number; tokens: string[] };

export type ContesState = Record<string, never>;

export type ContesPlayerView = {
  rerollTokens: PlayerMap<number>;
  shieldMalus: PlayerMap<number>;
  protectNextMalus: PlayerMap<boolean>;
  cape: PlayerMap<boolean>;
  replaceOne: PlayerMap<boolean>;
  noBonusTurns: PlayerMap<number>;
  forcedOneTurns: PlayerMap<number>;
  reverseNextTurn: PlayerMap<boolean>;
  blockedAt: PlayerMap<number | null>;
  keyOfGold: PlayerMap<boolean>;
  pawnByPlayerId: PlayerMap<string>;
  lastConte: {
    playerId: number;
    title: string;
    text: string;
    timestamp: string;
  } | null;
  turnReplacement: PlayerMap<number | null>;
};
