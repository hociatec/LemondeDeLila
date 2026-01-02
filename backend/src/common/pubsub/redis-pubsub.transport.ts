import Redis from 'ioredis';

export class RedisPubSubTransport<TEvent> {
  private readonly publisher: Redis;
  private readonly subscriber: Redis;

  constructor(
    private readonly url: string,
    private readonly channel: string,
  ) {
    this.publisher = new Redis(this.url, { lazyConnect: true });
    this.subscriber = new Redis(this.url, { lazyConnect: true });
  }

  async connect(): Promise<void> {
    await Promise.all([this.publisher.connect(), this.subscriber.connect()]);
  }

  async publish(event: TEvent): Promise<void> {
    await this.publisher.publish(this.channel, JSON.stringify(event));
  }

  async subscribe(handler: (event: TEvent) => void): Promise<void> {
    this.subscriber.on('message', (channel, message) => {
      if (channel !== this.channel) return;
      try {
        const parsed = JSON.parse(message) as TEvent;
        handler(parsed);
      } catch {
        /* ignore malformed payloads */
      }
    });
    await this.subscriber.subscribe(this.channel);
  }

  async disconnect(): Promise<void> {
    await Promise.all([
      this.publisher.disconnect(),
      this.subscriber.disconnect(),
    ]);
  }
}
