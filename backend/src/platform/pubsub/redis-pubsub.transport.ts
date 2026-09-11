import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import {
  currentCorrelationId,
  normalizeCorrelationId,
  runWithCorrelationId,
} from '../observability/public-api';

const MAX_PUBSUB_MESSAGE_BYTES = 1024 * 1024;

type CorrelatedPubSubEnvelope<TEvent> = {
  kind: 'lila.pubsub';
  schemaVersion: 1;
  eventId: string;
  occurredAt: string;
  correlationId: string;
  event: TEvent;
};

export type PubSubEventMetadata = {
  eventId: string;
  occurredAt: string;
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
        connectTimeout: 10_000,
        commandTimeout: 10_000,
        connectionName: name,
        // Pub/sub is best-effort. Fail fast when Redis is down instead of retrying many times
        // and blocking API requests (default ioredis maxRetriesPerRequest is 20).
        maxRetriesPerRequest: 1,
        autoResendUnfulfilledCommands: false,
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
        schemaVersion: 1,
        eventId: randomUUID(),
        occurredAt: new Date().toISOString(),
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

  async subscribe(
    handler: (event: TEvent, metadata: PubSubEventMetadata) => void,
  ): Promise<void> {
    this.subscriber.on('message', (channel, message) => {
      if (channel !== this.channel) return;
      try {
        if (Buffer.byteLength(message, 'utf8') > MAX_PUBSUB_MESSAGE_BYTES) {
          return;
        }
        const parsed: unknown = JSON.parse(message);
        const correlated = correlatedEnvelope(parsed);
        const event = this.decodeEvent(correlated?.event ?? parsed);
        if (event) {
          if (correlated) {
            runWithCorrelationId(correlated.correlationId, () =>
              handler(event, {
                eventId: correlated.eventId,
                occurredAt: correlated.occurredAt,
              }),
            );
          } else {
            handler(event, {
              eventId: randomUUID(),
              occurredAt: new Date().toISOString(),
            });
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
    candidate.schemaVersion !== 1 ||
    typeof candidate.eventId !== 'string' ||
    !candidate.eventId ||
    candidate.eventId.length > 128 ||
    typeof candidate.occurredAt !== 'string' ||
    candidate.occurredAt.length > 64 ||
    typeof candidate.correlationId !== 'string' ||
    candidate.correlationId.length > 128 ||
    !('event' in candidate)
  ) {
    return null;
  }
  return {
    kind: 'lila.pubsub',
    schemaVersion: 1,
    eventId: candidate.eventId,
    occurredAt: candidate.occurredAt,
    correlationId: normalizeCorrelationId(candidate.correlationId),
    event: candidate.event,
  };
}
