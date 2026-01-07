import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CatalogService } from '../../catalog/services/catalog.service';
import { GameStateEntity } from '../../game/core/entities/game-state.entity';
import { User } from '../../user/entities/user.entity';
import { GameMatch } from '../entities/game-match.entity';
import {
  GameMatchPlayer,
  GameMatchOutcome,
} from '../entities/game-match-player.entity';

export type MyStatsCounts = {
  finished: number;
  quit: number;
  won: number;
  lost: number;
};

export type MyGameStats = {
  gameType: string;
  gameName: string;
  withBots: MyStatsCounts;
  withoutBots: MyStatsCounts;
};

export type LeaderboardGame = { gameType: string; gameName: string };

export type LeaderboardEntry = {
  userId: number;
  username: string;
  wins: number;
  losses: number;
  finished: number;
  quit: number;
};

@Injectable()
export class GameStatsService {
  private readonly logger = new Logger(GameStatsService.name);

  constructor(
    @InjectRepository(GameMatch)
    private readonly matches: Repository<GameMatch>,
    @InjectRepository(GameMatchPlayer)
    private readonly players: Repository<GameMatchPlayer>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly catalog: CatalogService,
  ) {}

  async startMatch(params: {
    roomId: number;
    gameType: string;
    humans: Array<{ id: number; username: string }>;
    botsCount: number;
  }): Promise<GameMatch> {
    const gameType = (params.gameType ?? '').trim();
    if (!gameType) {
      throw new Error('gameType requis');
    }

    // Fermer tout match actif de la room (robustesse).
    await this.closeActiveMatch(params.roomId, 'restart');

    const match = this.matches.create({
      roomId: params.roomId,
      gameType,
      withBots: params.botsCount > 0,
      botsCount: params.botsCount,
      humansCount: params.humans.length,
      endedAt: null,
      endedReason: null,
      winnerUser: null,
    });
    await this.matches.save(match);

    for (const h of params.humans) {
      const user = await this.users.findOne({ where: { id: h.id } });
      if (!user) {
        continue;
      }
      const row = this.players.create({
        match,
        user,
        username: h.username,
        outcome: 'unknown',
        leftAt: null,
      });
      await this.players.save(row);
    }

    return match;
  }

  async markQuit(roomId: number, userId: number): Promise<void> {
    const match = await this.getActiveMatch(roomId);
    if (!match) return;
    const row = await this.players.findOne({
      where: { match: { id: match.id }, user: { id: userId } },
    });
    if (!row) return;
    if (
      row.outcome === 'won' ||
      row.outcome === 'lost' ||
      row.outcome === 'draw'
    ) {
      return;
    }
    row.outcome = 'quit';
    row.leftAt = row.leftAt ?? new Date();
    await this.players.save(row);
  }

  async endMatchOnReset(roomId: number): Promise<void> {
    await this.closeActiveMatch(roomId, 'reset');
  }

  async finalizeFinished(
    roomId: number,
    state: GameStateEntity,
  ): Promise<void> {
    const match = await this.getActiveMatch(roomId);
    if (!match) return;

    const winnerRaw = (state.metadata as any)?.winnerId ?? null;
    const winnerId = typeof winnerRaw === 'number' ? winnerRaw : null;
    const cooperative =
      typeof winnerRaw === 'string' && winnerRaw.trim() !== '';

    match.endedAt = new Date();
    match.endedReason = 'finished';
    match.winnerUser =
      winnerId != null
        ? await this.users.findOne({ where: { id: winnerId } })
        : null;
    await this.matches.save(match);

    const rows = await this.players.find({
      where: { match: { id: match.id } },
    });
    for (const row of rows) {
      if (row.outcome === 'quit') {
        continue;
      }

      row.outcome = this.resolveOutcome(
        row.user?.id ?? 0,
        winnerId,
        cooperative,
      );
      await this.players.save(row);
    }
  }

  async getMyStats(userId: number): Promise<MyGameStats[]> {
    const rows = await this.players.find({
      where: { user: { id: userId } },
      relations: ['match'],
    });

    const byGame = new Map<
      string,
      { withBots: MyStatsCounts; withoutBots: MyStatsCounts }
    >();

    for (const r of rows) {
      const match = (r as any).match as GameMatch | undefined;
      if (!match) continue;

      const key = match.gameType;
      if (!byGame.has(key)) {
        byGame.set(key, {
          withBots: { finished: 0, quit: 0, won: 0, lost: 0 },
          withoutBots: { finished: 0, quit: 0, won: 0, lost: 0 },
        });
      }
      const bucket = byGame.get(key)!;
      const target = match.withBots ? bucket.withBots : bucket.withoutBots;

      // Quit = partie quittée avant la fin (ou reset)
      if (r.outcome === 'quit') {
        target.quit += 1;
        continue;
      }

      // On ne compte "terminée" que si le match est clôturé.
      if (match.endedAt) {
        target.finished += 1;
      }
      if (r.outcome === 'won') target.won += 1;
      if (r.outcome === 'lost') target.lost += 1;
    }

    const results: MyGameStats[] = [];
    for (const [gameType, counts] of byGame.entries()) {
      const manifest = await this.catalog.getGame(gameType);
      results.push({
        gameType,
        gameName: manifest?.name ?? gameType,
        withBots: counts.withBots,
        withoutBots: counts.withoutBots,
      });
    }

    results.sort((a, b) => a.gameName.localeCompare(b.gameName, 'fr'));
    return results;
  }

  async getLeaderboardGames(): Promise<LeaderboardGame[]> {
    const rows = await this.matches
      .createQueryBuilder('m')
      .select('DISTINCT m.game_type', 'gameType')
      .where('m.ended_at IS NOT NULL')
      .orderBy('m.game_type', 'ASC')
      .getRawMany<{ gameType: string }>();

    const list: LeaderboardGame[] = [];
    for (const r of rows) {
      const gameType = String((r as any).gameType ?? '').trim();
      if (!gameType) continue;
      const manifest = await this.catalog.getGame(gameType);
      list.push({ gameType, gameName: manifest?.name ?? gameType });
    }

    list.sort((a, b) => a.gameName.localeCompare(b.gameName, 'fr'));
    return list;
  }

  async getTop10(gameType: string): Promise<LeaderboardEntry[]> {
    const normalized = (gameType ?? '').trim();
    if (!normalized) return [];

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
      .where('m.game_type = :gameType', { gameType: normalized })
      .andWhere('m.ended_reason = :reason', { reason: 'finished' })
      .groupBy('p.user_id')
      .orderBy('wins', 'DESC')
      .addOrderBy('finished', 'DESC')
      .addOrderBy('losses', 'ASC')
      .limit(10)
      .getRawMany();

    return rows.map((r: any) => ({
      userId: Number(r.userId),
      username: String(r.username ?? ''),
      wins: Number(r.wins ?? 0),
      losses: Number(r.losses ?? 0),
      finished: Number(r.finished ?? 0),
      quit: Number(r.quit ?? 0),
    }));
  }

  private resolveOutcome(
    userId: number,
    winnerId: number | null,
    cooperative: boolean,
  ): GameMatchOutcome {
    if (cooperative) {
      return 'won';
    }
    if (winnerId == null) {
      return 'lost';
    }
    return userId === winnerId ? 'won' : 'lost';
  }

  private async getActiveMatch(roomId: number): Promise<GameMatch | null> {
    return await this.matches.findOne({
      where: { roomId, endedAt: IsNull() },
      order: { startedAt: 'DESC' as any },
      relations: ['winnerUser'],
    });
  }

  private async closeActiveMatch(
    roomId: number,
    reason: string,
  ): Promise<void> {
    const match = await this.getActiveMatch(roomId);
    if (!match) return;

    match.endedAt = new Date();
    match.endedReason = reason;
    match.winnerUser = null;
    await this.matches.save(match);

    const rows = await this.players.find({
      where: { match: { id: match.id } },
    });
    for (const row of rows) {
      if (
        row.outcome === 'won' ||
        row.outcome === 'lost' ||
        row.outcome === 'draw'
      ) {
        continue;
      }
      row.outcome = 'quit';
      row.leftAt = row.leftAt ?? new Date();
      await this.players.save(row);
    }

    this.logger.warn(`Match actif clos (roomId=${roomId}, reason=${reason})`);
  }
}
