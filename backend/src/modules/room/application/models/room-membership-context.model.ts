import type { RoomRecord } from './room-record.model';
import type { RoomUserRecord } from './room-user.model';

export type RoomLeaveOptions = {
  preserveRoom?: boolean;
  disconnectOnly?: boolean;
  preserveOwner?: boolean;
  replaceWithBot?: boolean;
};

export type RoomMembershipContext = {
  invalidateRoomPayloadCache: (roomId: number) => Promise<void>;
  requireRoom: (roomId: number) => Promise<RoomRecord>;
  requireUser: (userId: number) => Promise<RoomUserRecord>;
  countActiveHumans: (roomId: number) => Promise<number>;
  countBots: (roomId: number) => Promise<number>;
  leaveAllRoomsForUser: (
    userId: number,
    options?: { exceptRoomId?: number },
  ) => Promise<void>;
  leaveRoom: (
    roomId: number,
    userId: number,
    options?: RoomLeaveOptions,
  ) => Promise<RoomRecord | null>;
  destroyRoom: (roomId: number) => Promise<{ ok: true; roomId: number }>;
};
/** Explicitly named data contract at the application boundary. */
