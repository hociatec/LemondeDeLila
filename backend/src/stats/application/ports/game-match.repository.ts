import type { GameMatchRecord } from '../models/game-match.model';
import type {
  GameMatchOutcome,
  GameMatchPlayerRecord,
} from '../models/game-match-player.model';

export const GAME_MATCH_REPOSITORY = Symbol('GAME_MATCH_REPOSITORY');

export interface GameMatchRepository {
  createMatch(data: {
    roomId: number;
    gameType: string;
    withBots: boolean;
    botsCount: number;
    humansCount: number;
  }): Promise<GameMatchRecord>;
  saveMatch(match: GameMatchRecord): Promise<GameMatchRecord>;
  findActiveMatchByRoomId(roomId: number): Promise<GameMatchRecord | null>;
  findPlayersByMatchId(matchId: number): Promise<GameMatchPlayerRecord[]>;
  findPlayer(matchId: number, userId: number): Promise<GameMatchPlayerRecord | null>;
  createPlayer(data: {
    matchId: number;
    userId: number;
    username: string;
    outcome: GameMatchOutcome;
    leftAt: Date | null;
  }): Promise<GameMatchPlayerRecord>;
  savePlayer(player: GameMatchPlayerRecord): Promise<GameMatchPlayerRecord>;
  findPlayersByUserId(userId: number): Promise<GameMatchPlayerRecord[]>;
  listFinishedGameTypes(): Promise<string[]>;
  getTop10(gameType: string): Promise<
    Array<{
      userId: number;
      username: string;
      wins: number;
      losses: number;
      finished: number;
      quit: number;
    }>
  >;
  resetAll(): Promise<{ deletedPlayers: number; deletedMatches: number }>;
}
