import type { RoomUserRecord } from './room-user.model';

export type RoomParticipantRoomRef = {
  id: number;
  gameType: string;
};

export type RoomParticipantRecord = {
  id: number;
  room: RoomParticipantRoomRef | null;
  user: RoomUserRecord;
  role: string;
  joinedAt: Date | null;
  leftAt: Date | null;
};
