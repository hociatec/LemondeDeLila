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
      decodeNotificationEvent,
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

function decodeNotificationEvent(value: unknown): NotificationEvent | null {
  if (
    !isRecord(value) ||
    typeof value.userId !== 'number' ||
    !Number.isSafeInteger(value.userId) ||
    typeof value.type !== 'string' ||
    (value.origin !== null && typeof value.origin !== 'string') ||
    (value.disconnect !== undefined && typeof value.disconnect !== 'boolean')
  ) {
    return null;
  }
  return {
    userId: value.userId,
    type: value.type,
    payload: value.payload,
    origin: value.origin,
    ...(value.disconnect === undefined ? {} : { disconnect: value.disconnect }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
