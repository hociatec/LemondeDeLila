export type PanierExpressTile =
  | { id: string; type: 'start' }
  | { id: string; type: 'stand'; standId: string }
  | { id: string; type: 'event' }
  | { id: string; type: 'exchange' }
  | { id: string; type: 'quiz' };

export type PanierExpressMetadata = {
  stands: string[];
  tiles: PanierExpressTile[];
  decks: {
    courses: string[];
    shoppingLists: string[][];
    events: string[];
    exchanges: string[];
    quizzes: Array<{ question: string; answer: string }>;
  };
  discards: {
    courses: string[];
    shoppingLists: string[][];
    events: string[];
    exchanges: string[];
    quizzes: Array<{ question: string; answer: string }>;
  };
  positions: Record<number, number>;
  winnerId?: number | null;
  statuses: {
    skipTurn: Record<number, number>;
  };
};
