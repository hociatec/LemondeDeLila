import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
  getErrorDetails,
  parseExplicitInstant,
} from '@shared/utils/public-api';
import { RedisClientFactory } from '../../../../../platform/redis/public-api';
import { NotificationConfigurationError } from '../../../domain/errors/notification-domain.errors';

export type InboxNotificationItem = {
  id: string;
  kind: string;
  createdAt: string;
  [key: string]: unknown;
};

@Injectable()
export class UserInboxRedisService implements OnModuleDestroy {
  private static readonly MAX_ITEM_BYTES = 256 * 1024;
  private static readonly MAX_LIST_LIMIT = 200;
  private static readonly MAX_IDENTIFIER_LENGTH = 128;
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
    if (!Number.isSafeInteger(userId) || userId <= 0) return;
    if (
      !item?.id ||
      typeof item.id !== 'string' ||
      item.id.length > UserInboxRedisService.MAX_IDENTIFIER_LENGTH
    )
      return;
    const score = parseExplicitInstant(item.createdAt);
    if (score === null)
      throw new RangeError('Notification creation instant is invalid');
    const json = JSON.stringify(item);
    if (
      Buffer.byteLength(json, 'utf8') > UserInboxRedisService.MAX_ITEM_BYTES
    ) {
      this.logger.warn(`Notification inbox trop volumineuse id=${item.id}`);
      return;
    }
    await this.ensureConnected();

    await this.redis
      .multi()
      .hset(this.hashKey(userId), item.id, json)
      .zadd(this.orderKey(userId), score, item.id)
      .exec();

    // Best-effort trim to avoid unbounded growth.
    await this.trim(userId, 200);
  }

  async list(userId: number, limit = 100): Promise<InboxNotificationItem[]> {
    if (!Number.isSafeInteger(userId) || userId <= 0) return [];
    if (!Number.isSafeInteger(limit) || limit < 1) return [];
    limit = Math.min(limit, UserInboxRedisService.MAX_LIST_LIMIT);
    await this.ensureConnected();

    const ids = await this.redis.zrevrange(this.orderKey(userId), 0, limit - 1);
    if (!ids?.length) return [];

    const raw = await this.redis.hmget(this.hashKey(userId), ...ids);
    const out: InboxNotificationItem[] = [];
    for (const value of raw) {
      if (!value) continue;
      if (
        Buffer.byteLength(value, 'utf8') > UserInboxRedisService.MAX_ITEM_BYTES
      ) {
        continue;
      }
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
    if (!Number.isSafeInteger(userId) || userId <= 0) return;
    if (
      !id ||
      typeof id !== 'string' ||
      id.length > UserInboxRedisService.MAX_IDENTIFIER_LENGTH
    )
      return;
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
    value.id.length <= 128 &&
    'kind' in value &&
    typeof value.kind === 'string' &&
    value.kind.length <= 128 &&
    'createdAt' in value &&
    typeof value.createdAt === 'string' &&
    value.createdAt.length <= 64
  );
}
