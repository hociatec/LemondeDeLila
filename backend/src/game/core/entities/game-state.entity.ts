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

export type PendingState = {
  type: string;
  playerId?: number | null;
  blocking?: boolean;
  data?: Record<string, unknown>;
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
  pending?: PendingState | null;
  /**
   * Indique qu'un bot est en cours de "reflexion" et qu'aucune action humaine ne doit etre acceptee.
   */
  botThinking?: boolean;
};
