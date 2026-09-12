export const GAME_ROOM_RUN_READER = Symbol('GAME_ROOM_RUN_READER');

export interface GameRoomRunReader {
  isCurrent(
    roomId: number,
    gameType: string,
    runId: number | null,
  ): Promise<boolean>;
}
