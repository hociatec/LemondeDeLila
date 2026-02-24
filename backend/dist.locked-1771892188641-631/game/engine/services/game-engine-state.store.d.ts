import { ConfigService } from '@nestjs/config';
import { RoomPayload } from '../../../room/dto/room-response.dto';
import { GameStateEntity } from '../../core/entities/game-state.entity';
import { RedisClientFactory } from '../../../common/redis/redis-client.factory';
export declare class GameEngineStateStore {
    private readonly config;
    private readonly redisFactory?;
    private readonly states;
    private readonly persistQueue;
    private redis;
    private readonly logger;
    private readonly redisPrefix;
    constructor(config: ConfigService, redisFactory?: RedisClientFactory | undefined);
    buildKey(roomId: number, gameType: string): string;
    get(roomId: number, gameType: string): Promise<GameStateEntity | undefined>;
    set(roomId: number, gameType: string, state: GameStateEntity, opts?: {
        asyncPersist?: boolean;
    }): Promise<void>;
    delete(roomId: number, gameType: string): Promise<void>;
    markBotThinking(state: GameStateEntity, botThinking: boolean): GameStateEntity;
    syncRoomStatus(state: GameStateEntity, payload: RoomPayload): GameStateEntity;
    private initializeRedis;
    private redisKey;
    private persistState;
    private enqueuePersist;
}
