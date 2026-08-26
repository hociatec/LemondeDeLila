import type { PlayerMap } from '../../../core/application/public-api';

export interface LamaConfig {
  loseAtScore: number;
  roundPauseSeconds: number;
  allowPlayAfterDraw: boolean;
  startingHandSize: number;
  copiesPerCardValue: number;
  returnTokenFromRound: number;
}

export type LamaStep = 'setup' | 'turn' | 'return' | 'pause';
export type LamaState = Record<string, never>;

export type LamaPlayerView = {
  step: LamaStep;
  scores: PlayerMap<number>;
  eliminated: PlayerMap<boolean>;
  droppedOut: PlayerMap<boolean>;
  drawnThisTurn: boolean;
  roundNumber: number;
  roundStarterIndex: number;
  roundWinnerId: number | null;
  topCard: number | null;
  winnerId: number | null;
};
