import type { RoomParticipantRecord } from '../contracts/room-participant.model';

export type RoomParticipantCreateRecord = Omit<
  Partial<RoomParticipantRecord>,
  'user'
> &
  Pick<RoomParticipantRecord, 'user'>;

export const ROOM_PARTICIPANT_REPOSITORY = Symbol(
  'ROOM_PARTICIPANT_REPOSITORY',
);

export interface RoomParticipantRepository {
  create(data: RoomParticipantCreateRecord): RoomParticipantRecord;
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
