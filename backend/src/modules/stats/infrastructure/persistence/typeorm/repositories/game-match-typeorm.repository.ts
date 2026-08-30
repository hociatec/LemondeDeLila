import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { GameMatchRepository } from '../../../../application/ports/game-match.repository';
import type { GameMatchRecord } from '../../../../application/contracts/game-match.model';
import { GameStatsDomainError } from '../../../../domain/errors/game-stats-domain.errors';
import type {
  GameMatchOutcome,
  GameMatchPlayerRecord,
} from '../../../../application/contracts/game-match-player.model';
import { GameMatchEntity } from '../entities/game-match.entity';
import { GameMatchPlayerEntity } from '../entities/game-match-player.entity';
import {
  toGameMatchEntity,
  toGameMatchModel,
  toGameMatchPlayerEntity,
  toGameMatchPlayerModel,
} from './game-match-typeorm.mapper';
import { GameMatchLeaderboardQueries } from './game-match-leaderboard.queries';

@Injectable()
export class GameMatchTypeormRepository implements GameMatchRepository {
  private readonly leaderboard: GameMatchLeaderboardQueries;

  constructor(
    @InjectRepository(GameMatchEntity)
    private readonly matches: Repository<GameMatchEntity>,
    @InjectRepository(GameMatchPlayerEntity)
    private readonly players: Repository<GameMatchPlayerEntity>,
  ) {
    this.leaderboard = new GameMatchLeaderboardQueries(matches, players);
  }

  async createMatchWithPlayers(data: {
    match: {
      roomId: number;
      gameType: string;
      withBots: boolean;
      botsCount: number;
      humansCount: number;
    };
    players: Array<{ userId: number; username: string }>;
  }): Promise<GameMatchRecord> {
    return this.matches.manager.transaction(async (manager) => {
      const matches = manager.getRepository(GameMatchEntity);
      const players = manager.getRepository(GameMatchPlayerEntity);
      const match = await matches.save(
        matches.create({
          ...data.match,
          endedAt: null,
          endedReason: null,
          winnerUser: null,
        }),
      );
      if (data.players.length > 0) {
        await players.save(
          data.players.map((player) =>
            players.create({
              match,
              user: { id: player.userId },
              username: player.username,
              outcome: 'unknown',
              leftAt: null,
            }),
          ),
        );
      }
      return toGameMatchModel(match);
    });
  }

  async saveMatchWithPlayers(
    match: GameMatchRecord,
    players: GameMatchPlayerRecord[],
  ): Promise<void> {
    await this.matches.manager.transaction(async (manager) => {
      const matches = manager.getRepository(GameMatchEntity);
      const playerRows = manager.getRepository(GameMatchPlayerEntity);
      await matches.save(toGameMatchEntity(matches, match));
      if (players.length > 0) {
        await playerRows.save(
          players.map((player) => toGameMatchPlayerEntity(playerRows, player)),
        );
      }
    });
  }

  async createMatch(data: {
    roomId: number;
    gameType: string;
    withBots: boolean;
    botsCount: number;
    humansCount: number;
  }): Promise<GameMatchRecord> {
    const match = await this.matches.save(
      this.matches.create({
        roomId: data.roomId,
        gameType: data.gameType,
        withBots: data.withBots,
        botsCount: data.botsCount,
        humansCount: data.humansCount,
        endedAt: null,
        endedReason: null,
        winnerUser: null,
      }),
    );
    return toGameMatchModel(match);
  }

  async saveMatch(match: GameMatchRecord): Promise<GameMatchRecord> {
    const saved = await this.matches.save(
      toGameMatchEntity(this.matches, match),
    );
    return toGameMatchModel(saved);
  }

  async findActiveMatchByRoomId(
    roomId: number,
  ): Promise<GameMatchRecord | null> {
    const match = await this.matches.findOne({
      where: { roomId, endedAt: IsNull() },
      order: { startedAt: 'DESC' },
      relations: { winnerUser: true },
    });
    return match ? toGameMatchModel(match) : null;
  }

  async findPlayersByMatchId(
    matchId: number,
  ): Promise<GameMatchPlayerRecord[]> {
    const rows = await this.players.find({
      where: { match: { id: matchId } },
      relations: { match: true },
      take: 100,
    });
    return rows.map(toGameMatchPlayerModel);
  }

  async findPlayer(
    matchId: number,
    userId: number,
  ): Promise<GameMatchPlayerRecord | null> {
    const row = await this.players.findOne({
      where: { match: { id: matchId }, user: { id: userId } },
      relations: { match: true },
    });
    return row ? toGameMatchPlayerModel(row) : null;
  }

  async createPlayer(data: {
    matchId: number;
    userId: number;
    username: string;
    outcome: GameMatchOutcome;
    leftAt: Date | null;
  }): Promise<GameMatchPlayerRecord> {
    const row = await this.players.save(
      this.players.create({
        match: { id: data.matchId } as GameMatchEntity,
        user: { id: data.userId },
        username: data.username,
        outcome: data.outcome,
        leftAt: data.leftAt,
      }),
    );
    const hydrated = await this.players.findOne({
      where: { id: row.id },
      relations: { match: true },
    });
    if (!hydrated)
      throw new GameStatsDomainError(
        'GAME_MATCH_PLAYER_NOT_FOUND',
        `Game match player ${row.id} not found after save`,
      );
    return toGameMatchPlayerModel(hydrated);
  }

  async createPlayers(
    data: Array<{
      matchId: number;
      userId: number;
      username: string;
      outcome: GameMatchOutcome;
      leftAt: Date | null;
    }>,
  ): Promise<void> {
    if (data.length === 0) return;
    await this.players.save(
      data.map((player) =>
        this.players.create({
          match: { id: player.matchId } as GameMatchEntity,
          user: { id: player.userId },
          username: player.username,
          outcome: player.outcome,
          leftAt: player.leftAt,
        }),
      ),
    );
  }

  async savePlayer(
    player: GameMatchPlayerRecord,
  ): Promise<GameMatchPlayerRecord> {
    const row = await this.players.save(
      this.players.create({
        id: player.id,
        match: { id: player.matchId } as GameMatchEntity,
        user: { id: player.userId },
        username: player.username,
        outcome: player.outcome,
        leftAt: player.leftAt,
      }),
    );
    const hydrated = await this.players.findOne({
      where: { id: row.id },
      relations: { match: true },
    });
    if (!hydrated)
      throw new GameStatsDomainError(
        'GAME_MATCH_PLAYER_NOT_FOUND',
        `Game match player ${row.id} not found after save`,
      );
    return toGameMatchPlayerModel(hydrated);
  }

  async savePlayers(players: GameMatchPlayerRecord[]): Promise<void> {
    if (players.length === 0) return;
    await this.players.save(
      players.map((player) => toGameMatchPlayerEntity(this.players, player)),
    );
  }

  async findPlayersByUserId(userId: number): Promise<GameMatchPlayerRecord[]> {
    const rows = await this.players.find({
      where: { user: { id: userId } },
      relations: { match: true },
      take: 5_000,
    });
    return rows.map(toGameMatchPlayerModel);
  }

  async listFinishedGameTypes(): Promise<string[]> {
    return this.leaderboard.listFinishedGameTypes();
  }

  async getTop10(gameType: string): Promise<
    Array<{
      userId: number;
      username: string;
      wins: number;
      losses: number;
      finished: number;
      quit: number;
    }>
  > {
    return this.leaderboard.getTop10(gameType);
  }

  async resetAll(): Promise<{
    deletedPlayers: number;
    deletedMatches: number;
  }> {
    const deletedPlayers = await this.players
      .createQueryBuilder()
      .delete()
      .execute();
    const deletedMatches = await this.matches
      .createQueryBuilder()
      .delete()
      .execute();
    return {
      deletedPlayers: deletedPlayers.affected ?? 0,
      deletedMatches: deletedMatches.affected ?? 0,
    };
  }
}
