import type { RoomParticipantRecord } from '../models/room-participant.model';

export const ROOM_PARTICIPANT_REPOSITORY = Symbol(
  'ROOM_PARTICIPANT_REPOSITORY',
);

export interface RoomParticipantRepository {
  create(data: Partial<RoomParticipantRecord>): RoomParticipantRecord;
  save(participant: RoomParticipantRecord): Promise<RoomParticipantRecord>;
  countActiveByRoom(roomId: number): Promise<number>;
  findActiveByRoomAndUser(
    roomId: number,
    userId: number,
  ): Promise<RoomParticipantRecord | null>;
  findActiveByRoomWithUsers(roomId: number): Promise<RoomParticipantRecord[]>;
  findFirstActiveByRoomWithUser(
    roomId: number,
  ): Promise<RoomParticipantRecord | null>;
  findActiveByUserWithRooms(userId: number): Promise<RoomParticipantRecord[]>;
  findLatestActiveRoomForUser(
    userId: number,
  ): Promise<{ roomId: number; gameType: string } | null>;
  createForRoom(roomId: number, userId: number, role: string): Promise<void>;
}
