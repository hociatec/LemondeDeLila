import type { ZigEtZagColor, ZigEtZagFamily } from './content';

export interface ZigEtZagPlay {
  playerId: number;
  playedCards: string[];
  faceDownCard?: string;
  faceUpCard?: string;
  invalidJoker?: boolean;
  lostByNoCard?: boolean;
}

export interface ZigEtZagRound {
  stage: 'selection' | 'battle-face-down' | 'battle-face-up';
  plays: ZigEtZagPlay[];
  waitingPlayers: number[];
  tiedPlayers: number[];
  triggerColors: Record<number, ZigEtZagColor | undefined>;
  triggerFamilies: Record<number, ZigEtZagFamily | undefined>;
  battleLog: string[];
}

export interface ZigEtZagRoundSummary {
  winnerId: number | null;
  cardsWon: number;
  plays: ZigEtZagPlay[];
  battleLog: string[];
}

export interface ZigEtZagState {
  initialDeckCounts: Record<number, number>;
  round: ZigEtZagRound;
  lastRound: ZigEtZagRoundSummary | null;
  winnerId: number | null;
}

export type ZigEtZagPlayerView = Omit<ZigEtZagState, 'round'> & {
  hand: string[];
  handCounts: Record<number, number>;
  stage: ZigEtZagRound['stage'];
  waitingPlayers: number[];
};
