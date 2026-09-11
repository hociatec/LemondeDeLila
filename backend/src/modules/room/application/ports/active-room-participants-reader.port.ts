export const ACTIVE_ROOM_PARTICIPANTS_READER = Symbol(
  'ACTIVE_ROOM_PARTICIPANTS_READER',
);

export interface ActiveRoomParticipant {
  userId: number;
  room: {
    id: number;
    name: string;
    status: string | null;
    startedAt: Date | null;
  } | null;
}

export interface ActiveRoomParticipantsReader {
  listActiveRoomsByUserIds(userIds: number[]): Promise<ActiveRoomParticipant[]>;
}
