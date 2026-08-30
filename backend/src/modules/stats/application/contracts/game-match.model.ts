export type GameMatchRecord = {
  id: number;
  roomId: number;
  gameType: string;
  withBots: boolean;
  botsCount: number;
  humansCount: number;
  startedAt: Date;
  endedAt: Date | null;
  endedReason: string | null;
  winnerUserId: number | null;
};
/** Explicitly named data contract at the application boundary. */
