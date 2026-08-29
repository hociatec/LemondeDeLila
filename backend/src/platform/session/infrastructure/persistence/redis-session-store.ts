import type {
  SessionState,
  SessionStateStore,
} from '../../application/ports/session-state-store.port';
import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { bestEffort } from '../../../../shared/utils/public-api';

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
      return decodeSessionState(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  async delete(connectionId: string): Promise<void> {
    await this.redis.del(this.prefix + connectionId);
  }

  async onModuleDestroy(): Promise<void> {
    await bestEffort(
      this.redis.quit(),
      'fermeture Redis sessions realtime',
      this.logger,
    );
  }
}

function decodeSessionState(value: unknown): SessionState | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    value.userId !== null &&
    (typeof value.userId !== 'number' || !Number.isSafeInteger(value.userId))
  ) {
    return null;
  }
  if (
    value.username !== undefined &&
    value.username !== null &&
    typeof value.username !== 'string'
  ) {
    return null;
  }
  if (
    value.roles !== undefined &&
    value.roles !== null &&
    (!Array.isArray(value.roles) ||
      !value.roles.every((role) => typeof role === 'string'))
  ) {
    return null;
  }
  return {
    userId: value.userId,
    username:
      typeof value.username === 'string' || value.username === null
        ? value.username
        : undefined,
    roles:
      Array.isArray(value.roles) || value.roles === null
        ? value.roles
        : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
