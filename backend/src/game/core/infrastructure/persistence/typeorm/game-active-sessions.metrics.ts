import {
  Injectable,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import { Gauge } from '@prometheus-io/client';
import { prometheusMetrics } from '../../../../../platform/observability/public-api';
import { MysqlGameActiveSessionsReader } from './mysql-game-active-sessions.reader';

/** A shared SQL count avoids counting only the rooms seen by the scraping process. */
@Injectable()
export class GameActiveSessionsMetrics
  implements OnModuleInit, OnModuleDestroy
{
  private gauge?: Gauge;
  private available?: Gauge;

  constructor(private readonly sessions: MysqlGameActiveSessionsReader) {}

  onModuleInit(): void {
    const registry = prometheusMetrics.registry;
    this.available = new Gauge({
      name: 'lila_game_active_sessions_collection_up',
      help: 'Succès de la lecture SQL du nombre de parties actives.',
      registers: [registry],
    });
    this.gauge = new Gauge({
      name: 'lila_game_active_sessions',
      help: 'Parties persistées started, playing ou paused, toutes instances confondues. Ne pas sommer entre instances.',
      registers: [registry],
      collect: () => this.collect(),
    });
  }

  async collect(): Promise<void> {
    try {
      const count = await this.sessions.countActive();
      if (!Number.isSafeInteger(count) || count < 0)
        throw new Error('Invalid active session count');
      this.gauge?.set(count);
      this.available?.set(1);
    } catch {
      this.gauge?.remove();
      this.available?.set(0);
    }
  }

  onModuleDestroy(): void {
    for (const { name, metric } of [
      { name: 'lila_game_active_sessions', metric: this.gauge },
      {
        name: 'lila_game_active_sessions_collection_up',
        metric: this.available,
      },
    ]) {
      if (metric && prometheusMetrics.registry.getSingleMetric(name) === metric)
        prometheusMetrics.registry.removeSingleMetric(name);
    }
  }
}
