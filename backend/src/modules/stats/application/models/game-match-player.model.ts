export type GameMatchOutcome = 'unknown' | 'won' | 'lost' | 'quit' | 'draw';

export type GameMatchPlayerRecord = {
  id: number;
  matchId: number;
  userId: number;
  username: string;
  outcome: GameMatchOutcome;
  leftAt: Date | null;
  match?: GameMatchSummary | null;
};

export type GameMatchSummary = {
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
