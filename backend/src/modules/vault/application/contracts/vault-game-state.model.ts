export type VaultGamePlayerState = {
  id?: number;
  username?: string | null;
  [key: string]: unknown;
};

export type VaultGameTurnState = {
  currentPlayerId?: number | null;
  [key: string]: unknown;
} | null;

export type VaultGameState = {
  status: string;
  metadata?: Record<string, unknown> | null;
  players?: VaultGamePlayerState[];
  turn?: VaultGameTurnState;
  [key: string]: unknown;
};

export function isVaultGameState(value: unknown): value is VaultGameState {
  if (!isRecord(value) || typeof value.status !== 'string') {
    return false;
  }
  if (
    value.metadata !== undefined &&
    value.metadata !== null &&
    !isRecord(value.metadata)
  ) {
    return false;
  }
  if (
    value.players !== undefined &&
    (!Array.isArray(value.players) ||
      !value.players.every(isVaultGamePlayerState))
  ) {
    return false;
  }
  return (
    value.turn === undefined || value.turn === null || isRecord(value.turn)
  );
}

function isVaultGamePlayerState(value: unknown): value is VaultGamePlayerState {
  return (
    isRecord(value) &&
    (value.id === undefined || typeof value.id === 'number') &&
    (value.username === undefined ||
      value.username === null ||
      typeof value.username === 'string')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/** Explicitly named data contract at the application boundary. */
