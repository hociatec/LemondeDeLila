export type RoomMatchPlayer = { id: number; username: string };

export interface RoomStatsPort {
  startMatch(input: {
    roomId: number;
    gameType: string;
    humans: RoomMatchPlayer[];
    botsCount: number;
  }): Promise<unknown>;
  markQuit(roomId: number, userId: number): Promise<void>;
  endMatchOnReset(roomId: number): Promise<void>;
}

export const ROOM_STATS_PORT = Symbol('ROOM_STATS_PORT');
