export const GAME_ROOM_LOCK = Symbol('GAME_ROOM_LOCK');

/**
 * Cross-process serialization boundary for commands targeting one room.
 * Correctness still relies on the state-store CAS; this lock only avoids
 * executing work that is guaranteed to lose the commit race.
 */
export interface GameRoomLock {
  runExclusive<T>(roomId: number, operation: () => Promise<T>): Promise<T>;
}

export class GameRoomLockUnavailableError extends Error {
  readonly code = 'GAME_ROOM_LOCK_UNAVAILABLE';

  constructor(readonly roomId: number) {
    super(`Verrou distribué indisponible pour la room ${roomId}`);
    this.name = GameRoomLockUnavailableError.name;
  }
}
