export type PresenceActiveRoomParticipant = {
  userId: number;
  room: {
    id: number;
    name: string;
    status: string | null;
    startedAt: Date | null;
  } | null;
};
/** Explicitly named data contract at the application boundary. */
