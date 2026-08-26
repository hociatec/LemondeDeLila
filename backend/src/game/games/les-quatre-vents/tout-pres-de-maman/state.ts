export type MamanTileType =
  | 'start'
  | 'neutral'
  | 'token'
  | 'card'
  | 'bonds'
  | 'slide'
  | 'storm'
  | 'nest'
  | 'meeting'
  | 'finish';

export interface MamanTile {
  id: number;
  title: string;
  type: MamanTileType;
  description?: string;
}

export interface MamanCard {
  id: number;
  text: string;
}

export type MamanPendingChoice = {
  kind: 'transfer-token' | 'share-advance' | 'meeting';
  actorId: number;
  depth: number;
};

export interface ToutPresDeMamanState {
  tokens: Record<number, number>;
  skipTurns: Record<number, number>;
  bonusReroll: Record<number, boolean>;
  lastRoll: number | null;
  winnerId: number | null;
  pendingChoice: MamanPendingChoice | null;
}

export type ToutPresDeMamanPlayerView = Omit<
  ToutPresDeMamanState,
  'pendingChoice'
> & {
  positions: Record<number, number>;
  deckCount: number;
  discardCount: number;
};
