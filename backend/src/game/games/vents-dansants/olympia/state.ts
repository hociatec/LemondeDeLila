import type { OlympiaStatusKey } from './content';

export interface OlympiaStatus {
  key: OlympiaStatusKey;
  turns: number;
  value?: number;
}

export interface OlympiaState {
  divinity: Record<number, string>;
  prestige: Record<number, number>;
  statuses: Record<number, OlympiaStatus[]>;
  skipTurns: Record<number, number>;
  drawnPlayerId: number | null;
  winnerIds: number[];
}

export type OlympiaPlayerView = OlympiaState & {
  hand: string[];
  handCounts: Record<number, number>;
  deckCounts: Record<string, number>;
};
