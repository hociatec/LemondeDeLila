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
  droppedOut: PlayerMap<boolean>;
  drawnThisTurn: boolean;
  roundStarterIndex: number;
  topCard: number | null;
};
