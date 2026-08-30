import type { Repository } from 'typeorm';
import { stringOrEmpty } from '@shared/utils/public-api';
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
    return rows.map((row) => String(row.gameType ?? '').trim()).filter(Boolean);
  }

  async getTop10(gameType: string) {
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
}
