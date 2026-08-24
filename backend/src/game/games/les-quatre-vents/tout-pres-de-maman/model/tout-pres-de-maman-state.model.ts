export type ToutPresDeMamanTileType =
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

export type ToutPresDeMamanTile = {
  id: number;
  title: string;
  type: ToutPresDeMamanTileType;
  description?: string;
};

export type ToutPresDeMamanCard = {
  id: number;
  text: string;
};

export type ToutPresDeMamanDecks = {
  deckCards: number[];
};

export type ToutPresDeMamanDiscards = {
  discardCards: number[];
};

export type ToutPresDeMamanStatuses = {
  skipTurn: Record<number, number>;
  bonusReroll: Record<number, boolean>;
};

export type ToutPresDeMamanMetadata = ToutPresDeMamanDecks &
  ToutPresDeMamanDiscards & {
    tiles: ToutPresDeMamanTile[];
    cards: ToutPresDeMamanCard[];
    positions: Record<number, number>;
    tokens: Record<number, number>;
    statuses: ToutPresDeMamanStatuses;
    pendingContext: null;
    winnerId: number | null;
  };

export type ToutPresDeMamanPendingContext = null;
