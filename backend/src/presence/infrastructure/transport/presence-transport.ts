import { RedisPubSubTransport } from '../../../common/pubsub/public-api';
import {
  PresenceEvent,
  PresenceTransport,
} from '../../application/ports/presence-transport.port';
import { RedisClientFactory } from '../../../common/redis/public-api';

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
