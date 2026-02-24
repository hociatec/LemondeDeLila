import { PresenceBroadcastPlayer } from './presence.service';
import { RedisClientFactory } from '../../common/redis/redis-client.factory';
export type PresenceEvent = {
    players: Array<Omit<PresenceBroadcastPlayer, 'contextLocked'>>;
    origin: string | null;
    at?: number;
};
export declare abstract class PresenceTransport {
    abstract connect(): Promise<void>;
    abstract publish(event: PresenceEvent): Promise<void>;
    abstract subscribe(handler: (event: PresenceEvent) => void): Promise<void>;
    abstract disconnect(): Promise<void>;
}
export declare class RedisPresenceTransport extends PresenceTransport {
    private readonly transport;
    constructor(url: string, redisFactory?: RedisClientFactory);
    connect(): Promise<void>;
    publish(event: PresenceEvent): Promise<void>;
    subscribe(handler: (event: PresenceEvent) => void): Promise<void>;
    disconnect(): Promise<void>;
}
