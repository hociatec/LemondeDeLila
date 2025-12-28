export type GaloponsTileType = 'start' | 'neutral' | 'card' | 'bonus' | 'skip' | 'finish';

export type GaloponsTile = {
  n: number;
  title: string;
  type: GaloponsTileType;
  region?: 'prairie' | 'riviere' | 'foret' | 'montagne';
  apples?: number;
  skipTurns?: number;
};

export type GaloponsCard = { id: number; text: string };

export type GaloponsMetadata = {
  tiles: GaloponsTile[];
  positions: Record<number, number>;
  apples: Record<number, number>;
  ious: Record<number, Record<number, number>>;
  statuses: { skipTurn: Record<number, number> };
  decks: { cards: GaloponsCard[]; discard: GaloponsCard[] };
  pendingContext?:
    | { kind: 'pair_advance' | 'give_apple' | 'help_advance'; actorId: number; replayAfter?: boolean }
    | null;
  finish?: { triggered: boolean; starterId: number | null; pendingIds: number[]; bonusGiven: boolean };
  winnerId?: number | null;
};

export type GaloponsCardsJsonV1 = { version: 1; cards: GaloponsCard[] };
export type GaloponsBoardJsonV1 = { version: 1; tiles: GaloponsTile[] };
