export type VaultGamePlayerState = {
  id?: number;
  username?: string | null;
  [key: string]: unknown;
};

export type VaultGameTurnState = {
  currentPlayerId?: number;
  [key: string]: unknown;
} | null;

export type VaultGameState = {
  status?: string;
  metadata?: Record<string, unknown> | null;
  players?: VaultGamePlayerState[];
  turn?: VaultGameTurnState;
  [key: string]: unknown;
};
