export const GAME_SESSION_RECOVERY_READER = Symbol(
  'GAME_SESSION_RECOVERY_READER',
);

export type GameSessionKey = { roomId: number; gameType: string };

/** Keyset pagination over persisted sessions; the state remains authoritative. */
export interface GameSessionRecoveryReader {
  listAfter(
    cursor: GameSessionKey | null,
    limit: number,
  ): Promise<GameSessionKey[]>;
}
