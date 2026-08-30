import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import { RedisClientFactory } from '../../../../platform/redis/public-api';
import { RoomPayload } from '../../application/contracts/room-payload.model';
import { decodeRoomPayload } from './room-payload.decoder';

@Injectable()
export class RoomPayloadCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RoomPayloadCacheService.name);
  private redis: Redis | null = null;
  private redisDisabled = false;
  private readonly prefix = 'room:payload:';
  private readonly ttlSeconds: number;

  constructor(
    private readonly config: ConfigService,
    private readonly redisFactory: RedisClientFactory,
  ) {
    const ttlCandidate = Number(
      this.config.get('ROOM_PAYLOAD_CACHE_TTL_SECONDS') ?? 15,
    );
    const ttl =
      Number.isFinite(ttlCandidate) && ttlCandidate >= 1 ? ttlCandidate : 15;
    this.ttlSeconds = Math.min(ttl, 3600);
  }

  async prime(roomId: number, payload: RoomPayload): Promise<void> {
    await this.persist(roomId, payload);
  }

  async invalidate(roomId: number): Promise<void> {
    const redis = this.getRedis();
    if (!redis) return;
    try {
      await redis.del(this.key(roomId));
    } catch (error) {
      this.disableRedis(
        'invalidation cache room impossible (fallback memoire)',
        error,
      );
    }
  }

  async update(
    roomId: number,
    updater: (payload: RoomPayload) => RoomPayload | null,
  ): Promise<RoomPayload | null> {
    const redis = this.getRedis();
    if (!redis) return null;

    try {
      const cached = await this.get(roomId);
      if (!cached) {
        return null;
      }
      const next = updater(cached);
      if (!next) {
        return null;
      }
      await this.persist(roomId, next);
      return next;
    } catch (error) {
      this.disableRedis(
        'mise a jour cache room impossible (fallback memoire)',
        error,
      );
      return null;
    }
  }

  async get(roomId: number): Promise<RoomPayload | null> {
    const redis = this.getRedis();
    if (!redis) return null;
    try {
      const raw = await redis.get(this.key(roomId));
      if (!raw) return null;
      return decodeRoomPayload(JSON.parse(raw));
    } catch (error) {
      this.disableRedis(
        'lecture cache room Redis impossible (fallback memoire)',
        error,
      );
      return null;
    }
  }

  async persist(roomId: number, payload: RoomPayload): Promise<void> {
    const redis = this.getRedis();
    if (!redis) return;
    try {
      await redis.set(
        this.key(roomId),
        JSON.stringify(payload),
        'EX',
        this.ttlSeconds,
      );
    } catch (error) {
      this.disableRedis(
        'ecriture cache room Redis impossible (fallback memoire)',
        error,
      );
    }
  }

  onModuleDestroy(): void {
    if (!this.redis) return;
    this.redis.disconnect();
    this.redis = null;
  }

  private key(roomId: number): string {
    return `${this.prefix}${roomId}`;
  }

  private getRedis(): Redis | null {
    if (this.redis) return this.redis;
    if (this.redisDisabled) return null;

    const redisUrl =
      this.config.get<string>('ROOM_PAYLOAD_REDIS_URL') ??
      this.config.get<string>('SESSION_STORE_REDIS_URL') ??
      null;
    if (!redisUrl) return null;

    try {
      this.redis = this.redisFactory.create(redisUrl, 'room-payload-cache');
      this.redis.on('error', (error: Error) => {
        if (!this.isFatalRedisError(error)) {
          return;
        }
        this.disableRedis(
          'erreur Redis fatale cache room (fallback memoire)',
          error,
        );
      });
    } catch (error) {
      this.disableRedis(
        'initialisation cache room Redis impossible (fallback memoire)',
        error,
      );
    }

    return this.redis;
  }

  private disableRedis(reason: string, error?: unknown): void {
    const details = this.extractErrorMessage(error);
    if (!this.redisDisabled) {
      this.logger.warn(details ? `${reason}: ${details}` : reason);
    }
    this.redisDisabled = true;
    if (!this.redis) {
      return;
    }
    try {
      this.redis.disconnect();
    } catch {
      // best effort
    }
    this.redis = null;
  }

  private isFatalRedisError(error: unknown): boolean {
    const message = this.extractErrorMessage(error) ?? '';
    const normalized = message.toLowerCase();
    return (
      normalized.includes('noauth') ||
      normalized.includes('wrongpass') ||
      normalized.includes('authentication') ||
      normalized.includes('connection is closed')
    );
  }

  private extractErrorMessage(error: unknown): string | null {
    if (error instanceof Error) {
      return error.message;
    }
    return typeof error === 'string' ? error : null;
  }
}
