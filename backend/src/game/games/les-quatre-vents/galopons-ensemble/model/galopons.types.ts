export type GaloponsTileType =
  | 'start'
  | 'neutral'
  | 'card'
  | 'bonus'
  | 'skip'
  | 'finish';

export type GaloponsTile = {
  n: number;
  title: string;
  type: GaloponsTileType;
  description?: string;
  region?: 'prairie' | 'riviere' | 'foret' | 'montagne';
  apples?: number;
  skipTurns?: number;
};

export type GaloponsCardEffect =
  | { kind: 'move'; delta: number }
  | { kind: 'move_to_next_region'; region: 'foret' | 'montagne' }
  | { kind: 'replay' }
  | { kind: 'gain_apples'; count: number }
  | { kind: 'skip_turn'; count: number }
  | { kind: 'give_apple_with_iou' }
  | { kind: 'discard_apple_and_replay' }
  | { kind: 'help_advance_for_apple'; delta: number }
  | { kind: 'pair_advance'; delta: number }
  | { kind: 'global_skip_turn'; count: number }
  | { kind: 'discard_apple' };

export type GaloponsCard = {
  id: number;
  text: string;
  effect?: GaloponsCardEffect;
};
export type GaloponsPawn = { id: string; name: string; description: string };

export type GaloponsMetadata = {
  tiles: GaloponsTile[];
  positions: Record<number, number>;
  apples: Record<number, number>;
  pawns: GaloponsPawn[];
  pawnByPlayerId: Record<number, string>;
  setupStarterId: number | null;
  ious: Record<number, Record<number, number>>;
  statuses: { skipTurn: Record<number, number> };
  decks: { cards: GaloponsCard[]; discard: GaloponsCard[] };
  finish?: {
    triggered: boolean;
    starterId: number | null;
    pendingIds: number[];
    bonusGiven: boolean;
  };
  winnerId?: number | null;
};

export type GaloponsCardsJsonV1 = { version: 1; cards: GaloponsCard[] };
export type GaloponsBoardJsonV1 = { version: 1; tiles: GaloponsTile[] };
export type GaloponsPawnsJsonV1 = { version: 1; pawns: GaloponsPawn[] };
