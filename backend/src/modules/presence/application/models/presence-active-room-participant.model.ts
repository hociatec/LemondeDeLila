export type PresenceActiveRoomParticipant = {
  userId: number;
  room: {
    id: number;
    name: string;
    status: string | null;
    startedAt: Date | null;
  } | null;
};
