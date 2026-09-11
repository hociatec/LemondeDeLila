import type { PresenceActiveRoomParticipant } from '../models/presence-active-room-participant.model';

export const PRESENCE_ROOM_PARTICIPANT_REPOSITORY = Symbol(
  'PRESENCE_ROOM_PARTICIPANT_REPOSITORY',
);

export interface PresenceRoomParticipantRepository {
  listActiveRoomsByUserIds(
    userIds: number[],
  ): Promise<PresenceActiveRoomParticipant[]>;
}
