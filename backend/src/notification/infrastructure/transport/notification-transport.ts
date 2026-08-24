import { RedisPubSubTransport } from '../../../common/pubsub/public-api';
import { RedisClientFactory } from '../../../common/redis/public-api';

export type NotificationEvent = {
  userId: number;
  type: string;
  payload: unknown;
  origin: string | null;
  disconnect?: boolean;
};

export abstract class NotificationTransport {
  abstract connect(): Promise<void>;
  abstract publish(event: NotificationEvent): Promise<void>;
  abstract subscribe(
    handler: (event: NotificationEvent) => void,
  ): Promise<void>;
  abstract disconnect(): Promise<void>;
}

export class RedisNotificationTransport extends NotificationTransport {
  private readonly transport: RedisPubSubTransport<NotificationEvent>;

  constructor(url: string, redisFactory?: RedisClientFactory) {
    super();
    this.transport = new RedisPubSubTransport<NotificationEvent>(
      url,
      'notifications',
      redisFactory
        ? (u, name) =>
            redisFactory.create(u, name, {
              lazyConnect: true,
              // Pub/sub notifications should never block API requests when Redis is down.
              maxRetriesPerRequest: 1,
              enableOfflineQueue: false,
              connectionName: name,
            })
        : undefined,
    );
  }

  connect(): Promise<void> {
    return this.transport.connect();
  }

  publish(event: NotificationEvent): Promise<void> {
    return this.transport.publish(event);
  }

  subscribe(handler: (event: NotificationEvent) => void): Promise<void> {
    return this.transport.subscribe(handler);
  }

  disconnect(): Promise<void> {
    return this.transport.disconnect();
  }
}
