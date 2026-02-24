import { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisClientFactory } from '../../common/redis/redis-client.factory';
export type InboxNotificationItem = {
    id: string;
    kind: string;
    createdAt: string;
    [key: string]: any;
};
export declare class UserInboxService implements OnModuleDestroy {
    private readonly logger;
    private readonly redis;
    private connected;
    constructor(config: ConfigService, redisFactory: RedisClientFactory);
    onModuleDestroy(): Promise<void>;
    private ensureConnected;
    private hashKey;
    private orderKey;
    add(userId: number, item: InboxNotificationItem): Promise<void>;
    list(userId: number, limit?: number): Promise<InboxNotificationItem[]>;
    delete(userId: number, id: string): Promise<void>;
    private trim;
}
