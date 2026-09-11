import type { Repository } from 'typeorm';
import { requireStrictInteger, stringOrEmpty } from '@shared/utils/public-api';
import { GameMatchEntity } from '../entities/game-match.entity';
import { GameMatchPlayerEntity } from '../entities/game-match-player.entity';

type Top10RawRow = {
  userId: unknown;
  username: unknown;
  wins: unknown;
  losses: unknown;
  finished: unknown;
  quit: unknown;
};

export class GameMatchLeaderboardQueries {
  constructor(
    private readonly matches: Repository<GameMatchEntity>,
    private readonly players: Repository<GameMatchPlayerEntity>,
  ) {}

  async listFinishedGameTypes(): Promise<string[]> {
    const rows = await this.matches
      .createQueryBuilder('m')
      .select('DISTINCT m.game_type', 'gameType')
      .where('m.ended_at IS NOT NULL')
      .orderBy('m.game_type', 'ASC')
      .limit(500)
      .getRawMany<{ gameType: string }>();
    return [
      ...new Set(
        rows
          .map((row) =>
            String(row.gameType ?? '')
              .trim()
              .slice(0, 128),
          )
          .filter(Boolean),
      ),
    ].slice(0, 500);
  }

  async getTop10(gameType: string) {
    if (
      typeof gameType !== 'string' ||
      !gameType.trim() ||
      gameType.length > 128
    ) {
      return [];
    }
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
      .where('m.game_type = :gameType', { gameType: gameType.trim() })
      .andWhere('m.ended_reason = :reason', { reason: 'finished' })
      .groupBy('p.user_id')
      .orderBy('wins', 'DESC')
      .addOrderBy('finished', 'DESC')
      .addOrderBy('losses', 'ASC')
      .addOrderBy('p.user_id', 'ASC')
      .limit(10)
      .getRawMany<Top10RawRow>();
    return rows.map((row) => ({
      userId: requireStrictInteger(row.userId, 'leaderboard.userId', {
        min: 1,
      }),
      username: stringOrEmpty(row.username),
      wins: requireStrictInteger(row.wins ?? 0, 'leaderboard.wins', { min: 0 }),
      losses: requireStrictInteger(row.losses ?? 0, 'leaderboard.losses', {
        min: 0,
      }),
      finished: requireStrictInteger(
        row.finished ?? 0,
        'leaderboard.finished',
        { min: 0 },
      ),
      quit: requireStrictInteger(row.quit ?? 0, 'leaderboard.quit', { min: 0 }),
    }));
  }
}
