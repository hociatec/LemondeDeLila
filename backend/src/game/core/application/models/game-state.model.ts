export type GameLogEntry = {
  key: string;
  /** Extensible localization parameters interpreted by the presentation edge. */
  params: Record<string, unknown>;
  timestamp?: string;
};

export type TurnState = {
  currentPlayerId: number | null;
  direction: 1 | -1;
  skippedPlayerIds?: number[];
  turnNumber?: number;
  actionPointsRemaining?: number;
  extraTurns?: number;
  scheduledTurnReplacements?: Record<string, number>;
  replacedSlotOwnerId?: number | null;
  simultaneousSessionId?: string | null;
  /**
   * Libellé prêt à afficher pour le tour courant (serveur source de vérité).
   */
  label?: string;
};

export type PlayerState = {
  id: number;
  username: string;
  isBot?: boolean;
  alive?: boolean;
};

export type PendingState = {
  /** Schema version of this persisted choice continuation. */
  schemaVersion?: number;
  type?: string;
  choiceId?: string;
  workflowKind?: string;
  /**
   * Libellé prêt à afficher pour la liste de choix (serveur source de vérité).
   */
  label?: string | null;
  playerId?: number | null;
  playerIds?: number[];
  resolvedPlayerIds?: number[];
  targetPlayerId?: number | null;
  blocking?: boolean;
  question?: string | null;
  choices?: string[];
  /** Persisted continuation owned by the selected workflow kind. */
  data?: { options?: unknown[]; [key: string]: unknown };
  queue?: PendingState[];
};

export type GameStateMetadata = {
  /** Infrastructure epoch renewed on every restoration, independent of replayed versions. */
  restoreId?: string;
  roomId?: number;
  roomOwnerId?: number | null;
  ownerPlayerId?: number | null;
  gameType?: string;
  roomStartedAt?: Date | string | null;
  roomRunId?: number | null;
  generatedAt?: string;
  rng?: { seed: number; counter: number };
};

/** Internal context used to select the appropriate delay before an automated move. */
export type GameAutomationContext = {
  lastAction?: {
    type: string;
    actorId: number | null;
  };
};

export type GameState<TGame extends object = object> = {
  /** Version monotone possédée par le moteur pour les commits CAS. */
  version?: number;
  status: string;
  phase: string;
  log: GameLogEntry[];
  players?: PlayerState[];
  turn?: TurnState;
  metadata?: GameStateMetadata;
  pending?: PendingState | null;
  automation?: GameAutomationContext;
  game?: TGame;
  /** Compatibility namespace for game-authored state outside engine kits. */
  extras?: Record<string, unknown>;
  board?: unknown;
};

/** Explicitly named data contract at the application boundary. */
