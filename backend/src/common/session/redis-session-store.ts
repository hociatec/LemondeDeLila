import type {
  SessionState,
  SessionStateStore,
} from './session-store.interface';

export class RedisSessionStore implements SessionStateStore {
  private readonly redis: any;
  private readonly prefix = 'ws:session:';

  constructor(redisUrl: string) {
    // Optional dependency: only required when Redis is enabled.

    const RedisCtor = require('ioredis');
    this.redis = new RedisCtor(redisUrl);
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
