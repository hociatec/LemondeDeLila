export type BotRoomRecord = {
  id: number;
  name: string;
  createdAt?: Date;
};

export type BotManagedRoomRecord = {
  id: number;
  maxPlayers: number;
  status: string;
  ownerId: number | null;
  startedAt?: Date | null;
};
/** Explicitly named data contract at the application boundary. */
