import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { GameSessionEntity } from './entities/game-session.entity';
import type {
  GameSessionKey,
  GameSessionRecoveryReader,
} from '../../../application/ports/game-session-recovery.reader';

/** MySQL JSON dialect is confined to this read-only aggregate adapter. */
@Injectable()
export class MysqlGameActiveSessionsReader implements GameSessionRecoveryReader {
  constructor(
    @InjectRepository(GameSessionEntity)
    private readonly sessions: Repository<GameSessionEntity>,
  ) {}

  countActive(): Promise<number> {
    return this.sessions
      .createQueryBuilder('session')
      .where(
        "JSON_UNQUOTE(JSON_EXTRACT(session.state, '$.status')) IN (:...statuses)",
        { statuses: ['started', 'playing', 'paused'] },
      )
      .maxExecutionTime(1000)
      .getCount();
  }

  async listAfter(
    cursor: GameSessionKey | null,
    limit: number,
  ): Promise<GameSessionKey[]> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
      throw new RangeError('Invalid recovery page size');
    const query = this.sessions
      .createQueryBuilder('session')
      .select(['session.roomId', 'session.gameType'])
      .where(
        "JSON_UNQUOTE(JSON_EXTRACT(session.state, '$.status')) <> :finished",
        { finished: 'finished' },
      );
    if (cursor)
      query.andWhere(
        '(session.roomId > :roomId OR (session.roomId = :roomId AND session.gameType > :gameType))',
        cursor,
      );
    const rows = await query
      .orderBy('session.roomId', 'ASC')
      .addOrderBy('session.gameType', 'ASC')
      .take(limit)
      .maxExecutionTime(1000)
      .getMany();
    return rows.map(({ roomId, gameType }) => ({ roomId, gameType }));
  }
}
