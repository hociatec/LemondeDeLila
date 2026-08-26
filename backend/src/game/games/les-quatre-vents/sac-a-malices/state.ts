import type { SacVariantId } from './content';

export type SacBuilding = {
  houses: number;
  hotel: boolean;
  mortgaged: boolean;
};

export type SacManagementKind = 'build' | 'sell' | 'mortgage' | 'unmortgage';

export interface SacState {
  variantId: SacVariantId;
  configured: boolean;
  money: Record<number, number>;
  ownership: Record<number, number>;
  buildings: Record<number, SacBuilding>;
  skipTurns: Record<number, number>;
  jailTurns: Record<number, number>;
  eliminated: Record<number, boolean>;
  jailCards: Record<number, number>;
  extraRoll: Record<number, boolean>;
  consecutiveDoubles: Record<number, number>;
  pot: number;
  lastRoll: number;
  pendingPurchase: { playerId: number; tileIndex: number } | null;
  pendingManagement: { playerId: number; kind: SacManagementKind } | null;
  winnerId: number | null;
}

export type SacPlayerView = Omit<
  SacState,
  'pendingPurchase' | 'pendingManagement'
> & {
  positions: Record<number, number>;
};
