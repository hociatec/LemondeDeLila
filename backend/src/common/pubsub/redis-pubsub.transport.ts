import { Logger } from '@nestjs/common';
import Redis from 'ioredis';

export class RedisPubSubTransport<TEvent> {
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private readonly logger = new Logger(RedisPubSubTransport.name);

  constructor(
    private readonly url: string,
    private readonly channel: string,
    private readonly createClient: (url: string, name: string) => Redis = (
      url,
      name,
    ) => {
      const client = new Redis(url, {
        lazyConnect: true,
        connectionName: name,
      });
      // Important: ioredis emits an 'error' event which will crash the process if unhandled.
      // Default transport is best-effort; dedicated factories can log details.
      client.on('error', () => {});
      return client;
    },
  ) {
    this.publisher = this.createClient(this.url, `pubsub:${this.channel}:pub`);
    this.subscriber = this.createClient(this.url, `pubsub:${this.channel}:sub`);
  }

  async connect(): Promise<void> {
    try {
      await Promise.all([this.publisher.connect(), this.subscriber.connect()]);
    } catch (error) {
      this.logger.warn(
        `Impossible de se connecter à Redis pubsub (${this.channel})`,
        error instanceof Error ? error.stack : String(error),
      );
    }
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

  disconnect(): Promise<void> {
    this.publisher.disconnect();
    this.subscriber.disconnect();
    return Promise.resolve();
  }
}
