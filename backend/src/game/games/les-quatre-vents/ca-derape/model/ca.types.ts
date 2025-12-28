export type CaTile = { label: string };

export type CaPending =
  | null
  | {
      type: 'choose_target';
      label: string;
      playerId: number;
      blocking: true;
      choices: string[];
      data: { context: string; targets: Array<{ targetPlayerId: number; targetUsername: string }> };
    }
  | {
      type: 'choose_next_player';
      label: string;
      playerId: number;
      blocking: true;
      choices: string[];
      data: { playerIds: number[] };
    };

export type CaCard = {
  id: number;
  title: string;
  category: string;
  kind:
    | 'move'
    | 'skip'
    | 'swap'
    | 'reroll'
    | 'double_next_move'
    | 'ignore_next_penalty'
    | 'choose_next_player'
    | 'global'
    | 'neutral'
    | 'conditional'
    | 'rule';
  moveDelta?: number;
  keepTurn?: boolean;
  text: string;
};

export type CaMetadata = {
  tiles: CaTile[];
  positions: Record<number, number>;
  lastMoveDelta: Record<number, number>;
  turnsSinceMoved: Record<number, number>;
  statuses: {
    skipTurn: Record<number, number>;
    ignoreNextPenalty: Record<number, boolean>;
    doubleNextMove: Record<number, boolean>;
    doubleNextRoll: Record<number, boolean>;
  };
  decks: {
    cards: CaCard[];
    discard: CaCard[];
  };
  pendingContext?: any;
  winnerId: number | null;
};

