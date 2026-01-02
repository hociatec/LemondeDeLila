import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoomPayload } from '../../../room/dto/room-response.dto';
import { GameStateEntity } from '../../core/entities/game-state.entity';
import type { Redis } from 'ioredis';
import { RedisClientFactory } from '../../../common/redis/redis-client.factory';

@Injectable()
export class GameEngineStateStore {
  private readonly states = new Map<string, GameStateEntity>();
  private redis: Redis | null = null;
  private readonly logger = new Logger(GameEngineStateStore.name);
  private readonly redisPrefix = 'game:state:';

  constructor(
    private readonly config: ConfigService,
    private readonly redisFactory: RedisClientFactory,
  ) {
    const redisUrl =
      this.config.get<string>('GAME_ENGINE_STATE_REDIS_URL') ??
      this.config.get<string>('SESSION_STORE_REDIS_URL') ??
      null;
    if (redisUrl) {
      this.initializeRedis(redisUrl);
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
      this.logger.error('Impossible de restaurer un état depuis Redis', error, {
        key,
      });
      return undefined;
    }
  }

  async set(
    roomId: number,
    gameType: string,
    state: GameStateEntity,
  ): Promise<void> {
    const key = this.buildKey(roomId, gameType);
    this.states.set(key, state);
    await this.persistState(key, state);
  }

  async delete(roomId: number, gameType: string): Promise<void> {
    const key = this.buildKey(roomId, gameType);
    this.states.delete(key);
    if (this.redis) {
      try {
        await this.redis.del(this.redisKey(key));
      } catch (error) {
        this.logger.error('Impossible de supprimer un état Redis', error, {
          key,
        });
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
    try {
      this.redis = this.redisFactory.create(url, 'game-engine-state-store');
      this.logger.log("GameEngineStateStore connecté à Redis.");
    } catch (error) {
      this.logger.error("Impossible d'initialiser Redis pour GameEngineStateStore", error instanceof Error ? error.stack : String(error));
      this.redis = null;
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
      this.logger.error('Impossible de persister un état Redis', error, {
        key,
      });
    }
  }
}
