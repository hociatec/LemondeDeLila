export type RoomCreateCommand = {
  userId: number;
  gameType: string;
  name?: string | null;
  maxPlayers?: number | null;
  isPrivate?: boolean;
  invalidateCache?: boolean;
};
