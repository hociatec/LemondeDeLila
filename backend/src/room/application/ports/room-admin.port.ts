export interface RoomAdminPort {
  adminCleanupRooms(input: {
    includePrivate: boolean;
    includeStarted: boolean;
    olderThanMinutes?: number;
    limit?: number;
    dryRun: boolean;
    excludeActivePlayers: boolean;
  }): Promise<unknown>;
  adminListRooms(input: {
    limit?: number;
    includePrivate: boolean;
    includeStarted: boolean;
    joinableOnly: boolean;
  }): Promise<unknown>;
  adminDestroyRoom(roomId: number): Promise<{ ok: true; roomId: number }>;
}

export const ROOM_ADMIN_PORT = Symbol('ROOM_ADMIN_PORT');
