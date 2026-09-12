import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { isBoundedJsonInput } from '../validation/public-api';
import { stringifyExternalJson } from '../serialization/public-api';
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
  private readonly handlers = new Set<
    (event: TEvent, metadata: PubSubEventMetadata) => void
  >();
  private subscription: Promise<void> | null = null;
  private closed = false;
  private readonly onReady = () => {
    // A command from the previous connection may settle after the ready event.
    const previous =
      this.subscription?.catch((error: unknown) => {
        this.logger.warn(
          'Previous Redis pubsub subscription failed before reconnecting',
          error instanceof Error ? error.message : String(error),
        );
      }) ?? Promise.resolve();
    void previous
      .then(() => this.ensureSubscribed())
      .catch((error: unknown) =>
        this.logger.warn(
          'Redis pubsub subscription unavailable',
          error instanceof Error ? error.message : String(error),
        ),
      );
  };
  private readonly onMessage = (channel: string, message: string) => {
    if (this.closed || channel !== this.channel) return;
    try {
      if (Buffer.byteLength(message, 'utf8') > MAX_PUBSUB_MESSAGE_BYTES) return;
      const parsed: unknown = JSON.parse(message);
      const correlated = correlatedEnvelope(parsed);
      const event = this.decodeEvent(correlated?.event ?? parsed);
      if (!event) return;
      const metadata = {
        eventId: correlated?.eventId ?? randomUUID(),
        occurredAt: correlated?.occurredAt ?? new Date().toISOString(),
      };
      for (const handler of this.handlers) {
        try {
          const deliver = () =>
            handler(structuredClone(event), { ...metadata });
          if (correlated)
            runWithCorrelationId(correlated.correlationId, deliver);
          else deliver();
        } catch {
          /* Isolate invalid event consumers. */
        }
      }
    } catch {
      /* Ignore malformed payloads. */
    }
  };

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
    this.subscriber.on('ready', this.onReady);
    this.subscriber.on('message', this.onMessage);
  }

  async connect(): Promise<void> {
    if (this.closed) return;
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
    if (this.closed) return;
    try {
      if (!isBoundedJsonInput(event, { allowUndefinedProperties: true }))
        throw new TypeError('Pub/sub event must contain plain JSON data');
      const envelope: CorrelatedPubSubEnvelope<TEvent> = {
        kind: 'lila.pubsub',
        schemaVersion: 1,
        eventId: randomUUID(),
        occurredAt: new Date().toISOString(),
        correlationId:
          currentCorrelationId() ?? normalizeCorrelationId(undefined),
        event,
      };
      const serialized = stringifyExternalJson(envelope);
      if (Buffer.byteLength(serialized, 'utf8') > MAX_PUBSUB_MESSAGE_BYTES)
        throw new RangeError('Pub/sub event too large');
      await this.publisher.publish(this.channel, serialized);
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
    if (this.closed) throw new Error('Pubsub transport disconnected');
    this.handlers.add(handler);
    await this.ensureSubscribed();
  }

  private ensureSubscribed(): Promise<void> {
    if (this.closed || this.handlers.size === 0) return Promise.resolve();
    if (this.subscription) return this.subscription;
    const pending = this.subscriber
      .subscribe(this.channel)
      .then(() => undefined);
    const active = pending.finally(() => {
      if (this.subscription === active) this.subscription = null;
    });
    this.subscription = active;
    return active;
  }

  disconnect(): Promise<void> {
    this.closed = true;
    this.handlers.clear();
    this.subscriber.off('ready', this.onReady);
    this.subscriber.off('message', this.onMessage);
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
