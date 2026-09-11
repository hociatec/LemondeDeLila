import { RedisPubSubTransport } from '../../../../platform/pubsub/public-api';
import {
  PresenceEvent,
  PresenceTransport,
} from '../../application/ports/presence-transport.port';
import { RedisClientFactory } from '../../../../platform/redis/public-api';
import {
  decodePresencePublicPlayer,
  type PresencePublicPlayer,
} from '../../application/services/presence-state.utils';

export class RedisPresenceTransport extends PresenceTransport {
  private readonly transport: RedisPubSubTransport<PresenceEvent>;

  constructor(url: string, redisFactory?: RedisClientFactory) {
    super();
    this.transport = new RedisPubSubTransport<PresenceEvent>(
      url,
      'presence-updates',
      decodePresenceEvent,
      redisFactory
        ? (u, name) =>
            redisFactory.create(u, name, {
              lazyConnect: true,
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

  publish(event: PresenceEvent): Promise<void> {
    return this.transport.publish(event);
  }

  subscribe(handler: (event: PresenceEvent) => void): Promise<void> {
    return this.transport.subscribe(handler);
  }

  disconnect(): Promise<void> {
    return this.transport.disconnect();
  }
}

function decodePresenceEvent(value: unknown): PresenceEvent | null {
  if (!isRecord(value) || !Array.isArray(value.players) || value.players.length > 1_000) {
    return null;
  }
  const players = value.players.filter(isPresencePublicPlayer);
  if (players.length !== value.players.length) {
    return null;
  }
  const origin = value.origin;
  if (origin !== null && (typeof origin !== 'string' || origin.length > 128)) {
    return null;
  }
  if (
    value.at !== undefined &&
    (typeof value.at !== 'number' || !Number.isFinite(value.at))
  ) {
    return null;
  }
  if (
    value.sequence !== undefined &&
    (typeof value.sequence !== 'number' ||
      !Number.isSafeInteger(value.sequence) ||
      value.sequence < 1)
  )
    return null;
  return {
    players,
    origin,
    ...(value.at === undefined ? {} : { at: value.at }),
    ...(value.sequence === undefined ? {} : { sequence: value.sequence }),
  };
}

function isPresencePublicPlayer(value: unknown): value is PresencePublicPlayer {
  if (!decodePresencePublicPlayer(value) || !isRecord(value)) {
    return false;
  }
  const availability = value.availability;
  const location = value.location;
  return (
    (availability === undefined ||
      availability === 'available' ||
      availability === 'occupied' ||
      availability === 'absent') &&
    (location === undefined || (typeof location === 'string' && location.length <= 255))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
