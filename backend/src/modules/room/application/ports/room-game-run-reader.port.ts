export const ROOM_GAME_RUN_READER = Symbol('ROOM_GAME_RUN_READER');

/** Authoritative decision; database failures must reject, never mean obsolete. */
export interface RoomGameRunReader {
  isCurrent(
    roomId: number,
    gameType: string,
    runId: number | null,
  ): Promise<boolean>;
}
