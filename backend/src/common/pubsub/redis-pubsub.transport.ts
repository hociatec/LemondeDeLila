import { createClient, RedisClientType } from 'redis';

export class RedisPubSubTransport<TEvent> {
  private readonly publisher: RedisClientType;
  private readonly subscriber: RedisClientType;

  constructor(private readonly url: string, private readonly channel: string) {
    this.publisher = createClient({ url: this.url });
    this.subscriber = createClient({ url: this.url });
  }

  async connect(): Promise<void> {
    await Promise.all([this.publisher.connect(), this.subscriber.connect()]);
  }

  async publish(event: TEvent): Promise<void> {
    await this.publisher.publish(this.channel, JSON.stringify(event));
  }

  async subscribe(handler: (event: TEvent) => void): Promise<void> {
    await this.subscriber.subscribe(this.channel, (message) => {
      try {
        const parsed = JSON.parse(message) as TEvent;
        handler(parsed);
      } catch {
        /* ignore malformed payloads */
      }
    });
  }

  async disconnect(): Promise<void> {
    await Promise.all([
      this.publisher.disconnect(),
      this.subscriber.disconnect(),
    ]);
  }
}
