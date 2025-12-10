export type GameLogEntry = { message: string; timestamp?: string };

export type TurnStateEntity = {
  currentPlayerId: number | null;
  direction: 1 | -1;
  skippedPlayerIds?: number[];
};

export type PlayerStateEntity = {
  id: number;
  username: string;
  isBot: boolean;
  basket: unknown[];
  inventory: unknown[];
  shoppingList: unknown[];
};

export type GameStateEntity = {
  status: string;
  phase: string;
  round: number;
  turnIndex: number;
  lastRoll: number | null;
  log: GameLogEntry[];
  players?: PlayerStateEntity[];
  turn?: TurnStateEntity;
  metadata?: Record<string, unknown>;
  /**
   * Indique qu'un bot est en cours de "réflexion" et qu'aucune action humaine ne doit être acceptée.
   */
  botThinking?: boolean;
};
