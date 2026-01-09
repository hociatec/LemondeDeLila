import type {
  SessionState,
  SessionStateStore,
} from './session-store.interface';
import { Logger } from '@nestjs/common';
import Redis from 'ioredis';

export class RedisSessionStore implements SessionStateStore {
  private readonly logger = new Logger(RedisSessionStore.name);
  private readonly redis: Redis;
  private readonly prefix = 'ws:session:';

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, { lazyConnect: true });
    this.redis.on('error', (err) => {
      this.logger.error(
        'redis error',
        err instanceof Error ? err.stack : String(err),
      );
    });
  }

  async save(connectionId: string, state: SessionState): Promise<void> {
    await this.redis.set(
      this.prefix + connectionId,
      JSON.stringify(state),
      'EX',
      60 * 60 * 24,
    );
  }

  async get(connectionId: string): Promise<SessionState | null> {
    const raw = await this.redis.get(this.prefix + connectionId);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SessionState;
    } catch {
      return null;
    }
  }

  async delete(connectionId: string): Promise<void> {
    await this.redis.del(this.prefix + connectionId);
  }
}
