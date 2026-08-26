import type { OlympiaStatusKey } from './content';
import type { PlayerMap } from '../../../core/application/public-api';

export interface OlympiaStatus {
  key: OlympiaStatusKey;
  turns: number;
  value?: number;
}

export type OlympiaState = Record<string, never>;

export type OlympiaPlayerView = {
  divinity: PlayerMap<string>;
  prestige: PlayerMap<number>;
  statuses: PlayerMap<OlympiaStatus[]>;
  drawnPlayerId: number | null;
  winnerIds: number[];
  skipTurns: PlayerMap<number>;
};
