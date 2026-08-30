import type { GameMatchRecord } from '../contracts/game-match.model';
import type {
  GameMatchOutcome,
  GameMatchPlayerRecord,
} from '../contracts/game-match-player.model';

export const GAME_MATCH_REPOSITORY = Symbol('GAME_MATCH_REPOSITORY');

export interface GameMatchRepository {
  createMatchWithPlayers(data: {
    match: {
      roomId: number;
      gameType: string;
      withBots: boolean;
      botsCount: number;
      humansCount: number;
    };
    players: Array<{ userId: number; username: string }>;
  }): Promise<GameMatchRecord>;
  saveMatchWithPlayers(
    match: GameMatchRecord,
    players: GameMatchPlayerRecord[],
  ): Promise<void>;
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
  findPlayer(
    matchId: number,
    userId: number,
  ): Promise<GameMatchPlayerRecord | null>;
  createPlayer(data: {
    matchId: number;
    userId: number;
    username: string;
    outcome: GameMatchOutcome;
    leftAt: Date | null;
  }): Promise<GameMatchPlayerRecord>;
  createPlayers(
    data: Array<{
      matchId: number;
      userId: number;
      username: string;
      outcome: GameMatchOutcome;
      leftAt: Date | null;
    }>,
  ): Promise<void>;
  savePlayer(player: GameMatchPlayerRecord): Promise<GameMatchPlayerRecord>;
  savePlayers(players: GameMatchPlayerRecord[]): Promise<void>;
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
