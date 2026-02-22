import { RedisClientFactory } from '../../common/redis/redis-client.factory';
export type NotificationEvent = {
    userId: number;
    type: string;
    payload: any;
    origin: string | null;
};
export declare abstract class NotificationTransport {
    abstract connect(): Promise<void>;
    abstract publish(event: NotificationEvent): Promise<void>;
    abstract subscribe(handler: (event: NotificationEvent) => void): Promise<void>;
    abstract disconnect(): Promise<void>;
}
export declare class RedisNotificationTransport extends NotificationTransport {
    private readonly transport;
    constructor(url: string, redisFactory?: RedisClientFactory);
    connect(): Promise<void>;
    publish(event: NotificationEvent): Promise<void>;
    subscribe(handler: (event: NotificationEvent) => void): Promise<void>;
    disconnect(): Promise<void>;
}
