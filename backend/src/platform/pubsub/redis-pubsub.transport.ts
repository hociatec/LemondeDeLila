import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import {
  currentCorrelationId,
  normalizeCorrelationId,
  runWithCorrelationId,
} from '../observability/public-api';

type CorrelatedPubSubEnvelope<TEvent> = {
  kind: 'lila.pubsub';
  correlationId: string;
  event: TEvent;
};

export class RedisPubSubTransport<TEvent> {
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private readonly logger = new Logger(RedisPubSubTransport.name);

  constructor(
    private readonly url: string,
    private readonly channel: string,
    private readonly decodeEvent: (value: unknown) => TEvent | null,
    private readonly createClient: (url: string, name: string) => Redis = (
      url,
      name,
    ) => {
      const client = new Redis(url, {
        lazyConnect: true,
        connectionName: name,
        // Pub/sub is best-effort. Fail fast when Redis is down instead of retrying many times
        // and blocking API requests (default ioredis maxRetriesPerRequest is 20).
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        enableReadyCheck: false,
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
    try {
      const envelope: CorrelatedPubSubEnvelope<TEvent> = {
        kind: 'lila.pubsub',
        correlationId:
          currentCorrelationId() ?? normalizeCorrelationId(undefined),
        event,
      };
      await this.publisher.publish(this.channel, JSON.stringify(envelope));
    } catch (error) {
      this.logger.warn(
        `Notification non publiée (Redis indisponible ? channel=${this.channel})`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async subscribe(handler: (event: TEvent) => void): Promise<void> {
    this.subscriber.on('message', (channel, message) => {
      if (channel !== this.channel) return;
      try {
        const parsed: unknown = JSON.parse(message);
        const correlated = correlatedEnvelope(parsed);
        const event = this.decodeEvent(correlated?.event ?? parsed);
        if (event) {
          if (correlated) {
            runWithCorrelationId(correlated.correlationId, () =>
              handler(event),
            );
          } else {
            handler(event);
          }
        }
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

function correlatedEnvelope(
  value: unknown,
): CorrelatedPubSubEnvelope<unknown> | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<CorrelatedPubSubEnvelope<unknown>>;
  if (
    candidate.kind !== 'lila.pubsub' ||
    typeof candidate.correlationId !== 'string' ||
    !('event' in candidate)
  ) {
    return null;
  }
  return {
    kind: 'lila.pubsub',
    correlationId: normalizeCorrelationId(candidate.correlationId),
    event: candidate.event,
  };
}
