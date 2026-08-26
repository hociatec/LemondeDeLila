import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { getErrorDetails } from '@common/utils/public-api';
import { RedisClientFactory } from '../../../../common/redis/public-api';
import { NotificationConfigurationError } from '../../../domain/errors/notification-domain.errors';

export type InboxNotificationItem = {
  id: string;
  kind: string;
  createdAt: string;
  [key: string]: unknown;
};

@Injectable()
export class UserInboxRedisService implements OnModuleDestroy {
  private readonly logger = new Logger(UserInboxRedisService.name);
  private readonly redis: Redis;
  private connected = false;

  constructor(config: ConfigService, redisFactory: RedisClientFactory) {
    const redisUrl =
      config.get<string>('NOTIFICATION_REDIS_URL') ||
      config.get<string>('SESSION_STORE_REDIS_URL');
    if (!redisUrl) {
      throw new NotificationConfigurationError(
        'NOTIFICATION_REDIS_URL ou SESSION_STORE_REDIS_URL doit être défini pour les notifications.',
      );
    }
    this.redis = redisFactory.create(redisUrl, 'notify-inbox', {
      lazyConnect: true,
    });
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis.quit();
    } catch {
      // ignore
    }
  }

  private async ensureConnected(): Promise<void> {
    if (this.connected) return;
    try {
      await this.redis.connect();
    } catch {
      // ignore (ioredis can auto-connect)
    }
    this.connected = true;
  }

  private hashKey(userId: number): string {
    return `notify:inbox:${userId}:items`;
  }

  private orderKey(userId: number): string {
    return `notify:inbox:${userId}:order`;
  }

  async add(userId: number, item: InboxNotificationItem): Promise<void> {
    if (!userId || userId <= 0) return;
    if (!item?.id) return;
    await this.ensureConnected();

    const json = JSON.stringify(item);
    const score = Date.parse(item.createdAt || '') || Date.now();

    await this.redis
      .multi()
      .hset(this.hashKey(userId), item.id, json)
      .zadd(this.orderKey(userId), score, item.id)
      .exec();

    // Best-effort trim to avoid unbounded growth.
    void this.trim(userId, 200);
  }

  async list(userId: number, limit = 100): Promise<InboxNotificationItem[]> {
    if (!userId || userId <= 0) return [];
    await this.ensureConnected();

    const ids = await this.redis.zrevrange(this.orderKey(userId), 0, limit - 1);
    if (!ids?.length) return [];

    const raw = await this.redis.hmget(this.hashKey(userId), ...ids);
    const out: InboxNotificationItem[] = [];
    for (const value of raw) {
      if (!value) continue;
      try {
        const parsed: unknown = JSON.parse(value);
        if (isInboxNotificationItem(parsed)) out.push(parsed);
      } catch {
        // ignore
      }
    }
    return out;
  }

  async delete(userId: number, id: string): Promise<void> {
    if (!userId || userId <= 0) return;
    if (!id || typeof id !== 'string') return;
    await this.ensureConnected();
    await this.redis
      .multi()
      .hdel(this.hashKey(userId), id)
      .zrem(this.orderKey(userId), id)
      .exec();
  }

  private async trim(userId: number, max: number): Promise<void> {
    try {
      await this.ensureConnected();
      const count = await this.redis.zcard(this.orderKey(userId));
      const extra = count - max;
      if (extra <= 0) return;

      const idsToRemove = await this.redis.zrange(
        this.orderKey(userId),
        0,
        extra - 1,
      );
      if (!idsToRemove?.length) return;

      await this.redis
        .multi()
        .zremrangebyrank(this.orderKey(userId), 0, extra - 1)
        .hdel(this.hashKey(userId), ...idsToRemove)
        .exec();
    } catch (err) {
      this.logger.debug('Inbox trim failed', getErrorDetails(err));
    }
  }
}

function isInboxNotificationItem(
  value: unknown,
): value is InboxNotificationItem {
  return (
    value != null &&
    typeof value === 'object' &&
    'id' in value &&
    typeof value.id === 'string' &&
    'kind' in value &&
    typeof value.kind === 'string' &&
    'createdAt' in value &&
    typeof value.createdAt === 'string'
  );
}
