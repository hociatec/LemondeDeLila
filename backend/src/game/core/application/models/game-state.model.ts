export type GameLogEntry = { message: string; timestamp?: string };

export type TurnStateEntity = {
  currentPlayerId: number | null;
  direction: 1 | -1;
  skippedPlayerIds?: number[];
  turnNumber?: number;
  actionPointsRemaining?: number;
  extraTurns?: number;
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
};

export type PendingState = {
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
};

export type GameStateMetadata = {
  roomId?: number;
  roomOwnerId?: number | null;
  ownerPlayerId?: number | null;
  gameType?: string;
  roomStartedAt?: Date | string | null;
  roomRunId?: number | null;
  generatedAt?: string;
  rng?: { seed: number; counter: number };
};

export type GameStateEntity<TGame extends object = object> = {
  /** Version monotone possédée par le moteur pour les commits CAS. */
  version?: number;
  status: string;
  phase: string;
  log: GameLogEntry[];
  players?: PlayerStateEntity[];
  turn?: TurnStateEntity;
  metadata?: GameStateMetadata;
  pending?: PendingState | null;
  game?: TGame;
  extras?: Record<string, unknown>;
  board?: unknown;
};
