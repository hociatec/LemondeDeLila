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
};
