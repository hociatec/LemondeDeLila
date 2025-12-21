import { RedisPubSubTransport } from '../../common/pubsub/redis-pubsub.transport';

export type NotificationEvent = {
  userId: number;
  type: string;
  payload: any;
  origin: string | null;
};

export abstract class NotificationTransport {
  abstract connect(): Promise<void>;
  abstract publish(event: NotificationEvent): Promise<void>;
  abstract subscribe(handler: (event: NotificationEvent) => void): Promise<void>;
  abstract disconnect(): Promise<void>;
}

export class RedisNotificationTransport extends NotificationTransport {
  private readonly transport: RedisPubSubTransport<NotificationEvent>;

  constructor(url: string) {
    super();
    this.transport = new RedisPubSubTransport<NotificationEvent>(
      url,
      'notifications',
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
