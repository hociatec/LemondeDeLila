export type GameLogEntry = { message: string; timestamp?: string };

export type TurnStateEntity = {
  currentPlayerId: number | null;
  direction: 1 | -1;
  skippedPlayerIds?: number[];
  /**
   * Libellé prêt à afficher pour le tour courant (serveur source de vérité).
   */
  label?: string;
};

export type PlayerStateEntity = {
  id: number;
  username: string;
  isBot?: boolean;
  alive?: boolean;
  // Champs historiques (Panier Express). Optionnels pour éviter de polluer les autres jeux.
  basket?: unknown[];
  inventory?: unknown[];
  shoppingList?: unknown[];
  pawn?: string;
  pawnLabel?: string;
};

export type PendingState = {
  /** Some legacy games identify their pending state with `step` only. */
  type?: string;
  /**
   * Libellé prêt à afficher pour la liste de choix (serveur source de vérité).
   */
  label?: string | null;
  playerId?: number | null;
  targetPlayerId?: number | null;
  blocking?: boolean;
  question?: string | null;
  choices?: string[];
  data?: Record<string, unknown>;
  step?: string | null;
  initiatorPlayerId?: number | null;
};

export type GameStateEntity = {
  status: string;
  phase: string;
  round: number;
  turnIndex: number;
  lastRoll: number | null;
  lastDraw?: { playerId: number | null; at: string } | null;
  log: GameLogEntry[];
  players?: PlayerStateEntity[];
  turn?: TurnStateEntity;
  metadata?: unknown;
  pending?: PendingState | null;
  extras?: Record<string, unknown>;
  board?: unknown;
  /**
   * Indique qu'un bot est en cours de "reflexion" et qu'aucune action humaine ne doit etre acceptee.
   */
  botThinking?: boolean;
  botThinkingSince?: number | null;
};
