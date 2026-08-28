import type { PlayerMap } from '../../../core/application/public-api';

export interface ZigEtZagPlayState {
  playerId: number;
  playedCards: string[];
}

export interface ZigEtZagPlay extends ZigEtZagPlayState {
  faceDownCard?: string;
  faceUpCard?: string;
  invalidJoker?: boolean;
}

export interface ZigEtZagRound {
  plays: ZigEtZagPlayState[];
  tiedPlayers: number[];
}

export interface ZigEtZagRoundSummary {
  roundNumber: number;
  roundWinnerPlayerId: number | null;
  cardsWon: number;
  plays: ZigEtZagPlayState[];
}

export interface ZigEtZagState {
  battle: ZigEtZagRound;
  lastRound: ZigEtZagRoundSummary | null;
}

export interface ZigEtZagBattleLogEntry {
  key: 'zig.battle.started' | 'zig.battle.continues';
  params: { roundNumber: number };
}

export type ZigEtZagPlayerView = {
  initialDeckCounts: PlayerMap<number>;
  lastRound:
    (ZigEtZagRoundSummary & { battleLog: ZigEtZagBattleLogEntry[] }) | null;
  stage: 'selection' | 'battle-face-down' | 'battle-face-up';
  waitingPlayers: number[];
};
