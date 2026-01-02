import { RedisPubSubTransport } from '../../common/pubsub/redis-pubsub.transport';
import { PresenceBroadcastPlayer } from './presence.service';
import { RedisClientFactory } from '../../common/redis/redis-client.factory';

export type PresenceEvent = {
  players: Array<Omit<PresenceBroadcastPlayer, 'contextLocked'>>;
  origin: string | null;
  at?: number; // epoch ms
};

export abstract class PresenceTransport {
  abstract connect(): Promise<void>;
  abstract publish(event: PresenceEvent): Promise<void>;
  abstract subscribe(handler: (event: PresenceEvent) => void): Promise<void>;
  abstract disconnect(): Promise<void>;
}

export class RedisPresenceTransport extends PresenceTransport {
  private readonly transport: RedisPubSubTransport<PresenceEvent>;

  constructor(url: string, redisFactory?: RedisClientFactory) {
    super();
    this.transport = new RedisPubSubTransport<PresenceEvent>(
      url,
      'presence-updates',
      redisFactory
        ? (u, name) => redisFactory.create(u, name, { lazyConnect: true })
        : undefined,
    );
  }

  connect(): Promise<void> {
    return this.transport.connect();
  }

  publish(event: PresenceEvent): Promise<void> {
    return this.transport.publish(event);
  }

  subscribe(handler: (event: PresenceEvent) => void): Promise<void> {
    return this.transport.subscribe(handler);
  }

  disconnect(): Promise<void> {
    return this.transport.disconnect();
  }
}
