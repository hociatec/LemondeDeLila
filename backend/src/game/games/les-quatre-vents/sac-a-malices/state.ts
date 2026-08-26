import type { PlayerMap } from '../../../core/application/public-api';

export type SacBuilding = {
  houses: number;
  hotel: boolean;
  mortgaged: boolean;
};

export type SacManagementKind = 'build' | 'sell' | 'mortgage' | 'unmortgage';

export interface SacState {
  buildings: Record<number, SacBuilding>;
}

export type SacPlayerView = {
  buildings: Record<number, SacBuilding>;
  jailTurns: PlayerMap<number>;
  jailCards: PlayerMap<number>;
  consecutiveDoubles: PlayerMap<number>;
  pot: number;
  extraRoll: PlayerMap<boolean>;
};
