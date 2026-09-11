import type {
  SessionState,
  SessionStateStore,
} from '../../application/ports/session-state-store.port';
import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { bestEffort } from '../../../observability/public-api';

export class RedisSessionStore implements SessionStateStore {
  private static readonly MAX_SESSION_BYTES = 64 * 1024;
  private static readonly SESSION_TTL_SECONDS = 24 * 60 * 60;
  private readonly logger = new Logger(RedisSessionStore.name);
  private readonly redis: Redis;
  private readonly prefix = 'ws:session:';

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      connectTimeout: 10_000,
      commandTimeout: 10_000,
      maxRetriesPerRequest: 1,
      autoResendUnfulfilledCommands: false,
    });
    this.redis.on('error', (err) => {
      this.logger.error(
        'redis error',
        err instanceof Error ? err.stack : String(err),
      );
    });
  }

  async save(connectionId: string, state: SessionState): Promise<void> {
    const key = this.key(connectionId);
    if (!key) throw new RangeError('Identifiant de connexion invalide');
    if (!decodeSessionState(state)) {
      throw new RangeError('Etat de session invalide');
    }
    const serialized = JSON.stringify(state);
    if (typeof serialized !== 'string') {
      throw new RangeError('Etat de session non serialisable');
    }
    if (
      Buffer.byteLength(serialized, 'utf8') >
      RedisSessionStore.MAX_SESSION_BYTES
    ) {
      throw new RangeError('Session WS trop volumineuse');
    }
    await this.redis.set(
      key,
      serialized,
      'EX',
      RedisSessionStore.SESSION_TTL_SECONDS,
    );
  }

  async get(connectionId: string): Promise<SessionState | null> {
    const key = this.key(connectionId);
    if (!key) return null;
    const raw = await this.redis.get(key);
    if (!raw) return null;
    if (Buffer.byteLength(raw, 'utf8') > RedisSessionStore.MAX_SESSION_BYTES) {
      await bestEffort(
        this.redis.del(key),
        'suppression session WS trop volumineuse',
        this.logger,
      );
      return null;
    }
    try {
      return decodeSessionState(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  async delete(connectionId: string): Promise<void> {
    const key = this.key(connectionId);
    if (key) await this.redis.del(key);
  }

  async onModuleDestroy(): Promise<void> {
    await bestEffort(
      this.redis.quit(),
      'fermeture Redis sessions realtime',
      this.logger,
    );
  }

  private key(connectionId: string): string | null {
    const normalized = String(connectionId ?? '').trim();
    if (!normalized || normalized.length > 128) return null;
    return this.prefix + normalized;
  }
}

function decodeSessionState(value: unknown): SessionState | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    value.userId !== null &&
    (typeof value.userId !== 'number' ||
      !Number.isSafeInteger(value.userId) ||
      value.userId <= 0)
  ) {
    return null;
  }
  if (
    value.username !== undefined &&
    value.username !== null &&
    (typeof value.username !== 'string' ||
      value.username.length === 0 ||
      value.username.length > 255)
  ) {
    return null;
  }
  if (
    value.roles !== undefined &&
    value.roles !== null &&
    (!Array.isArray(value.roles) ||
      value.roles.length > 32 ||
      !value.roles.every(
        (role) =>
          typeof role === 'string' && role.length > 0 && role.length <= 64,
      ))
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
