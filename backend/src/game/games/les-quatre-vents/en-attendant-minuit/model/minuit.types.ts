export type MinuitTileType =
  | 'start'
  | 'neutral'
  | 'card'
  | 'move'
  | 'skip'
  | 'finish';

export type MinuitTile = {
  n: number;
  title: string;
  description?: string;
  type: MinuitTileType;
  delta?: number;
  skipTurns?: number;
};

export type MinuitPawn = {
  id?: string;
  title: string;
  description?: string;
};

export type MinuitCard = {
  id: number;
  title: string;
  category: string;
  kind: string;
  lines: string[];
};

export type MinuitPendingQuiz = {
  playerId: number;
  question: string;
  choices: string[];
  answer?: string;
  anyCorrect?: boolean;
  successDelta?: number;
  failureDelta?: number;
};

export type MinuitMetadata = {
  tiles: MinuitTile[];
  positions: Record<number, number>;
  pawns?: Record<number, string>;
  pawnChoices?: MinuitPawn[];
  statuses: {
    skipTurn: Record<number, number>;
    ignoreNextMalus: Record<number, boolean>;
    ignoreNextSkip: Record<number, boolean>;
    forceDrawNextTurn: Record<number, boolean>;
    keepTurn: Record<number, number>;
  };
  decks: { cards: MinuitCard[]; discard: MinuitCard[] };
  pendingQuiz?: MinuitPendingQuiz | null;
  pendingContext?: { kind: 'swap' | 'gift'; actorId: number } | null;
  winnerId?: number | null;
};

export type MinuitCardsJsonV1 = { version: 1; cards: MinuitCard[] };
export type MinuitBoardJsonV1 = { version: 1; tiles: MinuitTile[] };
export type MinuitPawnsJsonV1 = { version: 1; pawns: MinuitPawn[] };
