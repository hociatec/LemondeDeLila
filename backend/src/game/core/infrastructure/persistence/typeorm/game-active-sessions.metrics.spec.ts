import type { Repository } from 'typeorm';
import { prometheusMetrics } from '../../../../../platform/observability/public-api';
import { GameActiveSessionsMetrics } from './game-active-sessions.metrics';
import { MysqlGameActiveSessionsReader } from './mysql-game-active-sessions.reader';
import type { GameSessionEntity } from './entities/game-session.entity';

it('counts active sessions with a bounded SQL aggregate and omits unavailable data', async () => {
  const getCount = jest
    .fn()
    .mockResolvedValueOnce(12)
    .mockRejectedValue(new Error('offline'));
  const query = {
    where: jest.fn().mockReturnThis(),
    maxExecutionTime: jest.fn().mockReturnThis(),
    getCount,
  };
  const collector = new GameActiveSessionsMetrics(
    new MysqlGameActiveSessionsReader({
      createQueryBuilder: () => query,
    } as unknown as Repository<GameSessionEntity>),
  );
  collector.onModuleInit();
  try {
    await collector.collect();
    expect(query.where).toHaveBeenCalledWith(
      expect.stringContaining('JSON_EXTRACT'),
      { statuses: ['started', 'playing', 'paused'] },
    );
    expect(query.maxExecutionTime).toHaveBeenCalledWith(1000);
    const value = await prometheusMetrics.registry
      .getSingleMetric('lila_game_active_sessions_collection_up')!
      .get();
    expect(value.values[0].value).toBe(1);
    await collector.collect();
    const unavailable = await prometheusMetrics.registry
      .getSingleMetric('lila_game_active_sessions_collection_up')!
      .get();
    expect(unavailable.values[0].value).toBe(0);
    const output = await prometheusMetrics.registry.metrics();
    expect(output).not.toMatch(/^lila_game_active_sessions /m);
  } finally {
    collector.onModuleDestroy();
  }
});
