import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoomPayload } from '../../../room/dto/room-response.dto';
import { GameStateEntity } from '../../core/entities/game-state.entity';
import type { Redis } from 'ioredis';
import { RedisClientFactory } from '../../../common/redis/redis-client.factory';

@Injectable()
export class GameEngineStateStore {
  private readonly states = new Map<string, GameStateEntity>();
  private readonly persistQueue = new Map<string, Promise<void>>();
  private redis: Redis | null = null;
  private redisDisabled = false;
  private readonly logger = new Logger(GameEngineStateStore.name);
  private readonly redisPrefix = 'game:state:';

  constructor(
    private readonly config: ConfigService,
    private readonly redisFactory?: RedisClientFactory,
  ) {
    const redisUrl =
      this.config.get<string>('GAME_ENGINE_STATE_REDIS_URL') ??
      this.config.get<string>('SESSION_STORE_REDIS_URL') ??
      null;
    if (redisUrl && this.redisFactory) {
      this.initializeRedis(redisUrl);
    } else if (redisUrl && !this.redisFactory) {
      this.logger.warn(
        'Redis configuré mais RedisClientFactory indisponible : fallback en mémoire.',
      );
    } else {
      this.logger.warn(
        'GAME_ENGINE_STATE_REDIS_URL non défini : fallback en mémoire (non persistant).',
      );
    }
  }

  buildKey(roomId: number, gameType: string): string {
    return `${gameType}:${roomId}`;
  }

  async get(
    roomId: number,
    gameType: string,
  ): Promise<GameStateEntity | undefined> {
    const key = this.buildKey(roomId, gameType);
    const cached = this.states.get(key);
    if (cached) {
      return cached;
    }
    if (!this.redis) {
      return undefined;
    }
    try {
      const raw = await this.redis.get(this.redisKey(key));
      if (!raw) return undefined;
      const parsed = JSON.parse(raw) as GameStateEntity;
      this.states.set(key, parsed);
      return parsed;
    } catch (error) {
      this.disableRedis(
        'lecture impossible depuis Redis (fallback mémoire)',
        error,
      );
      return undefined;
    }
  }

  async set(
    roomId: number,
    gameType: string,
    state: GameStateEntity,
    opts?: { asyncPersist?: boolean },
  ): Promise<void> {
    const key = this.buildKey(roomId, gameType);
    this.states.set(key, state);
    if (opts?.asyncPersist) {
      this.enqueuePersist(key, state);
      return;
    }
    await this.persistState(key, state);
  }

  async delete(roomId: number, gameType: string): Promise<void> {
    const key = this.buildKey(roomId, gameType);
    this.states.delete(key);
    if (this.redis) {
      try {
        await this.redis.del(this.redisKey(key));
      } catch (error) {
        this.disableRedis(
          'suppression impossible dans Redis (fallback mémoire)',
          error,
        );
      }
    }
  }

  markBotThinking(
    state: GameStateEntity,
    botThinking: boolean,
  ): GameStateEntity {
    return { ...state, botThinking };
  }

  syncRoomStatus(
    state: GameStateEntity,
    payload: RoomPayload,
  ): GameStateEntity {
    const payloadStatus = payload?.room?.status;
    if (!payloadStatus || payloadStatus === state.status) {
      return state;
    }
    if (
      (state.status || '').toLowerCase() === 'started' &&
      payloadStatus !== 'finished'
    ) {
      return state;
    }
    return { ...state, status: payloadStatus };
  }
  private initializeRedis(url: string): void {
    if (!this.redisFactory) {
      this.redis = null;
      return;
    }
    if (this.redisDisabled) {
      return;
    }
    try {
      this.redis = this.redisFactory.create(url, 'game-engine-state-store');
      this.redis.on('error', (error: Error) => {
        if (!this.isFatalRedisError(error)) {
          return;
        }
        this.disableRedis('erreur Redis fatale (fallback mémoire)', error);
      });
      this.logger.log('GameEngineStateStore connecté à Redis.');
    } catch (error) {
      this.disableRedis(
        'initialisation Redis impossible (fallback mémoire)',
        error,
      );
    }
  }

  private redisKey(key: string): string {
    return `${this.redisPrefix}${key}`;
  }

  private async persistState(
    key: string,
    state: GameStateEntity,
  ): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.set(
        this.redisKey(key),
        JSON.stringify(state),
        'EX',
        60 * 60 * 24,
      );
    } catch (error) {
      this.disableRedis(
        'écriture impossible dans Redis (fallback mémoire)',
        error,
      );
    }
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

  private enqueuePersist(key: string, state: GameStateEntity): void {
    const previous = this.persistQueue.get(key) ?? Promise.resolve();
    const next = previous
      .then(() => this.persistState(key, state))
      .catch(() => undefined);
    this.persistQueue.set(key, next);
    void next.finally(() => {
      if (this.persistQueue.get(key) === next) {
        this.persistQueue.delete(key);
      }
    });
  }
}
