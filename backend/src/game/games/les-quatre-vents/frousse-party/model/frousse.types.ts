export type FrousseTileType = 'neutral' | 'card' | 'finish';

export type FrousseTile = { n: number; title: string; type: FrousseTileType };

export type FrousseCard = {
  id: number;
  localNumber: number;
  category: string;
  text: string;
};

export type FrousseMetadata = {
  tiles: FrousseTile[];
  positions: Record<number, number>;
  statuses: {
    skipTurn: Record<number, number>;
    ignoreNextTrap: Record<number, boolean>;
    ignoreNextPrank: Record<number, boolean>;
    ignoreNextGhost: Record<number, boolean>;
    nextMoveCap: Record<number, number>;
    nextRollMalus: Record<number, number>;
    nextRollKeepLowest: Record<number, boolean>;
    nextRollDouble: Record<number, boolean>;
    nextRollIfThreeBackTwo: Record<number, boolean>;
    blocked: Record<
      number,
      | null
      | { kind: 'need_roll_one_of'; allowed: number[] }
      | { kind: 'need_roll_min'; min: number }
      | { kind: 'need_roll_even' }
    >;
  };
  decks: { cards: FrousseCard[]; discard: FrousseCard[] };
  pendingContext?: { kind: 'swap'; actorId: number } | null;
  winnerId?: number | null;
};

export type FrousseCardsJsonV1 = { version: 1; cards: FrousseCard[] };
export type FrousseBoardJsonV1 = { version: 1; tiles: FrousseTile[] };
