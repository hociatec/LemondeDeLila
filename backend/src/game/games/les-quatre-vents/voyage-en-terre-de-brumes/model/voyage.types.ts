export type VoyageTileType =
  | 'start'
  | 'finish'
  | 'neutral'
  | 'rest'
  | 'passage'
  | 'legend'
  | 'farce'
  | 'treasure'
  | 'landscape';

export type VoyageTile = {
  id: number;
  title: string;
  type: VoyageTileType;
  label?: string;
  description?: string;
};

export type VoyageCard = {
  id: number;
  title: string;
  description: string;
  effect: string;
};

export type VoyageDeck = { cards: VoyageCard[]; discard: VoyageCard[] };

export type VoyagePendingQuiz = {
  playerId: number;
  cardId: number;
  card: VoyageCard;
  question: string;
  choices: string[];
  answer?: string;
};

export type VoyageMetadata = {
  tiles: VoyageTile[];
  positions: Record<number, number>;
  statuses: {
    skipTurn: Record<number, number>;
    lastTargetByActor?: Record<number, number>;
  };
  decks: {
    legend: VoyageDeck;
    farce: VoyageDeck;
    treasure: VoyageDeck;
    landscape: VoyageDeck;
  };
  collections: Record<
    number,
    { legend: number; treasure: number; landscape: number; farce: number }
  >;
  pendingQuiz?: VoyagePendingQuiz | null;
  finishCountdown?: number | null;
  winnerId?: number | null;
};

export type VoyageBoardJsonV1 = { version: 1; tiles: VoyageTile[] };
export type VoyageCardsJsonV1 = { version: 1; cards: VoyageCard[] };
