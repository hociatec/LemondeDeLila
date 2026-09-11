import {
  RedisPubSubTransport,
  type PubSubEventMetadata,
} from '../../../../platform/pubsub/public-api';
import { RedisClientFactory } from '../../../../platform/redis/public-api';

export type NotificationEvent = {
  userId: number;
  type: string;
  payload: Record<string, unknown> | null;
  origin: string | null;
  disconnect?: boolean;
};

export const MAX_NOTIFICATION_EVENT_BYTES = 256 * 1024;

export abstract class NotificationTransport {
  abstract connect(): Promise<void>;
  abstract publish(event: NotificationEvent): Promise<void>;
  abstract subscribe(
    handler: (event: NotificationEvent, metadata: PubSubEventMetadata) => void,
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
              enableReadyCheck: false,
              connectionName: name,
            })
        : undefined,
    );
  }

  connect(): Promise<void> {
    return this.transport.connect();
  }

  publish(event: NotificationEvent): Promise<void> {
    assertNotificationEventSize(event);
    return this.transport.publish(event);
  }

  subscribe(
    handler: (event: NotificationEvent, metadata: PubSubEventMetadata) => void,
  ): Promise<void> {
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
    value.type.length === 0 ||
    value.type.length > 128 ||
    (value.origin !== null && typeof value.origin !== 'string') ||
    (typeof value.origin === 'string' && value.origin.length > 128) ||
    (value.payload !== null &&
      value.payload !== undefined &&
      !isRecord(value.payload)) ||
    (value.disconnect !== undefined && typeof value.disconnect !== 'boolean')
  ) {
    return null;
  }
  const event: NotificationEvent = {
    userId: value.userId,
    type: value.type,
    payload: value.payload == null ? null : value.payload,
    origin: value.origin,
    ...(value.disconnect === undefined ? {} : { disconnect: value.disconnect }),
  };
  try {
    if (
      Buffer.byteLength(JSON.stringify(event), 'utf8') >
      MAX_NOTIFICATION_EVENT_BYTES
    ) {
      return null;
    }
  } catch {
    return null;
  }
  return event;
}

function assertNotificationEventSize(event: NotificationEvent): void {
  if (
    !event.type ||
    event.type.length > 128 ||
    (event.origin !== null && event.origin.length > 128)
  ) {
    throw new RangeError('Notification event metadata invalide');
  }
  const bytes = Buffer.byteLength(JSON.stringify(event), 'utf8');
  if (bytes > MAX_NOTIFICATION_EVENT_BYTES) {
    throw new RangeError('Notification event trop volumineux');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
