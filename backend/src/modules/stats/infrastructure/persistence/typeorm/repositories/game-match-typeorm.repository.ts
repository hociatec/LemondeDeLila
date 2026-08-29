import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { GameMatchRepository } from '../../../../application/ports/game-match.repository';
import type { GameMatchRecord } from '../../../../application/models/game-match.model';
import { GameStatsDomainError } from '../../../../domain/errors/game-stats-domain.errors';
import type {
  GameMatchOutcome,
  GameMatchPlayerRecord,
  GameMatchSummary,
} from '../../../../application/models/game-match-player.model';
import { GameMatchEntity } from '../entities/game-match.entity';
import { GameMatchPlayerEntity } from '../entities/game-match-player.entity';
import { stringOrEmpty } from '@shared/utils/public-api';

type Top10RawRow = {
  userId: unknown;
  username: unknown;
  wins: unknown;
  losses: unknown;
  finished: unknown;
  quit: unknown;
};

@Injectable()
export class GameMatchTypeormRepository implements GameMatchRepository {
  constructor(
    @InjectRepository(GameMatchEntity)
    private readonly matches: Repository<GameMatchEntity>,
    @InjectRepository(GameMatchPlayerEntity)
    private readonly players: Repository<GameMatchPlayerEntity>,
  ) {}

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
      return this.toMatchModel(match);
    });
  }

  async saveMatchWithPlayers(
    match: GameMatchRecord,
    players: GameMatchPlayerRecord[],
  ): Promise<void> {
    await this.matches.manager.transaction(async (manager) => {
      const matches = manager.getRepository(GameMatchEntity);
      const playerRows = manager.getRepository(GameMatchPlayerEntity);
      await matches.save(this.matchEntity(matches, match));
      if (players.length > 0) {
        await playerRows.save(
          players.map((player) => this.playerEntity(playerRows, player)),
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
    return this.toMatchModel(match);
  }

  async saveMatch(match: GameMatchRecord): Promise<GameMatchRecord> {
    const saved = await this.matches.save(
      this.matchEntity(this.matches, match),
    );
    return this.toMatchModel(saved);
  }

  async findActiveMatchByRoomId(
    roomId: number,
  ): Promise<GameMatchRecord | null> {
    const match = await this.matches.findOne({
      where: { roomId, endedAt: IsNull() },
      order: { startedAt: 'DESC' },
      relations: { winnerUser: true },
    });
    return match ? this.toMatchModel(match) : null;
  }

  async findPlayersByMatchId(
    matchId: number,
  ): Promise<GameMatchPlayerRecord[]> {
    const rows = await this.players.find({
      where: { match: { id: matchId } },
      relations: { match: true },
      take: 100,
    });
    return rows.map((row) => this.toPlayerModel(row));
  }

  async findPlayer(
    matchId: number,
    userId: number,
  ): Promise<GameMatchPlayerRecord | null> {
    const row = await this.players.findOne({
      where: { match: { id: matchId }, user: { id: userId } },
      relations: { match: true },
    });
    return row ? this.toPlayerModel(row) : null;
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
    return this.toPlayerModel(hydrated);
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
    return this.toPlayerModel(hydrated);
  }

  async savePlayers(players: GameMatchPlayerRecord[]): Promise<void> {
    if (players.length === 0) return;
    await this.players.save(
      players.map((player) => this.playerEntity(this.players, player)),
    );
  }

  async findPlayersByUserId(userId: number): Promise<GameMatchPlayerRecord[]> {
    const rows = await this.players.find({
      where: { user: { id: userId } },
      relations: { match: true },
      take: 5_000,
    });
    return rows.map((row) => this.toPlayerModel(row));
  }

  async listFinishedGameTypes(): Promise<string[]> {
    const rows = await this.matches
      .createQueryBuilder('m')
      .select('DISTINCT m.game_type', 'gameType')
      .where('m.ended_at IS NOT NULL')
      .orderBy('m.game_type', 'ASC')
      .getRawMany<{ gameType: string }>();
    return rows.map((row) => String(row.gameType ?? '').trim()).filter(Boolean);
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
    const rows = await this.players
      .createQueryBuilder('p')
      .innerJoin('p.match', 'm')
      .select('p.user_id', 'userId')
      .addSelect('MAX(p.username)', 'username')
      .addSelect("SUM(CASE WHEN p.outcome = 'won' THEN 1 ELSE 0 END)", 'wins')
      .addSelect(
        "SUM(CASE WHEN p.outcome = 'lost' THEN 1 ELSE 0 END)",
        'losses',
      )
      .addSelect(
        "SUM(CASE WHEN p.outcome IN ('won','lost','draw') THEN 1 ELSE 0 END)",
        'finished',
      )
      .addSelect("SUM(CASE WHEN p.outcome = 'quit' THEN 1 ELSE 0 END)", 'quit')
      .where('m.game_type = :gameType', { gameType })
      .andWhere('m.ended_reason = :reason', { reason: 'finished' })
      .groupBy('p.user_id')
      .orderBy('wins', 'DESC')
      .addOrderBy('finished', 'DESC')
      .addOrderBy('losses', 'ASC')
      .limit(10)
      .getRawMany<Top10RawRow>();

    return rows.map((row) => ({
      userId: Number(row.userId),
      username: stringOrEmpty(row.username),
      wins: Number(row.wins ?? 0),
      losses: Number(row.losses ?? 0),
      finished: Number(row.finished ?? 0),
      quit: Number(row.quit ?? 0),
    }));
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

  private toMatchModel(match: GameMatchEntity): GameMatchRecord {
    return {
      id: match.id,
      roomId: match.roomId,
      gameType: match.gameType,
      withBots: match.withBots,
      botsCount: match.botsCount,
      humansCount: match.humansCount,
      startedAt: match.startedAt,
      endedAt: match.endedAt ?? null,
      endedReason: match.endedReason ?? null,
      winnerUserId: match.winnerUser?.id ?? null,
    };
  }

  private matchEntity(
    repository: Repository<GameMatchEntity>,
    match: GameMatchRecord,
  ): GameMatchEntity {
    return repository.create({
      id: match.id,
      roomId: match.roomId,
      gameType: match.gameType,
      withBots: match.withBots,
      botsCount: match.botsCount,
      humansCount: match.humansCount,
      startedAt: match.startedAt,
      endedAt: match.endedAt,
      endedReason: match.endedReason,
      winnerUser:
        match.winnerUserId != null ? { id: match.winnerUserId } : null,
    });
  }

  private playerEntity(
    repository: Repository<GameMatchPlayerEntity>,
    player: GameMatchPlayerRecord,
  ): GameMatchPlayerEntity {
    return repository.create({
      id: player.id,
      match: { id: player.matchId } as GameMatchEntity,
      user: { id: player.userId },
      username: player.username,
      outcome: player.outcome,
      leftAt: player.leftAt,
    });
  }

  private toPlayerModel(player: GameMatchPlayerEntity): GameMatchPlayerRecord {
    return {
      id: player.id,
      matchId: player.match?.id ?? 0,
      userId: player.user.id,
      username: player.username,
      outcome: player.outcome,
      leftAt: player.leftAt ?? null,
      match: player.match ? this.toMatchSummary(player.match) : null,
    };
  }

  private toMatchSummary(match: GameMatchEntity): GameMatchSummary {
    return {
      id: match.id,
      roomId: match.roomId,
      gameType: match.gameType,
      withBots: match.withBots,
      botsCount: match.botsCount,
      humansCount: match.humansCount,
      startedAt: match.startedAt,
      endedAt: match.endedAt ?? null,
      endedReason: match.endedReason ?? null,
      winnerUserId: match.winnerUser?.id ?? null,
    };
  }
}
