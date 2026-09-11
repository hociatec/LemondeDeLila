import type { PresenceEvent } from '../ports/presence-transport.port';
import {
  decodePresencePublicPlayer,
  type PresencePublicPlayer,
} from './presence-state.utils';
import { operationalSettings } from '../../../../platform/config/public-api';

type OriginSnapshot = {
  at: number;
  players: readonly PresencePublicPlayer[];
  sequence?: number;
  publishedAt?: number;
};

/** Replaceable snapshots, ordered per process; liveness uses the receiver's clock. */
export class PresenceOrigins {
  private readonly origins = new Map<string, OriginSnapshot>();

  constructor(
    private readonly now: () => number,
    private readonly ttlMs = operationalSettings.presenceOriginsCacheTtlMs,
  ) {}

  accept(event: PresenceEvent): boolean {
    if (
      typeof event.origin !== 'string' ||
      event.origin.length === 0 ||
      event.origin.length > 128 ||
      !Array.isArray(event.players) ||
      event.players.length > 1_000
    )
      return false;
    if (
      event.sequence !== undefined &&
      (!Number.isSafeInteger(event.sequence) || event.sequence < 1)
    )
      return false;
    if (event.at !== undefined && !Number.isFinite(event.at)) return false;
    const players: PresencePublicPlayer[] = [];
    const playerIds = new Set<number>();
    for (const value of event.players) {
      const player = decodePresencePublicPlayer(value);
      if (!player || playerIds.has(player.id)) return false;
      playerIds.add(player.id);
      players.push(
        Object.freeze({
          ...player,
          currentRoom: player.currentRoom
            ? Object.freeze(player.currentRoom)
            : null,
        }),
      );
    }
    const previous = this.origins.get(event.origin);
    if (previous) {
      if (
        previous.sequence !== undefined &&
        (event.sequence === undefined || event.sequence <= previous.sequence)
      )
        return false;
      if (
        previous.sequence === undefined &&
        event.sequence === undefined &&
        previous.publishedAt !== undefined &&
        event.at !== undefined &&
        event.at <= previous.publishedAt
      )
        return false;
    }
    if (!previous && this.origins.size >= 10_000) {
      const expired = [...this.origins].find(
        ([, entry]) => this.now() - entry.at >= this.ttlMs,
      );
      if (!expired) return false;
      this.origins.delete(expired[0]);
    }
    this.origins.set(
      event.origin,
      Object.freeze({
        at: this.now(),
        players: Object.freeze(players),
        ...(event.sequence === undefined ? {} : { sequence: event.sequence }),
        ...(event.at === undefined ? {} : { publishedAt: event.at }),
      }),
    );
    return true;
  }

  snapshot(): ReadonlyMap<string, OriginSnapshot> {
    const now = this.now();
    const active = new Map<string, OriginSnapshot>();
    for (const [origin, entry] of this.origins) {
      if (now - entry.at >= this.ttlMs)
        this.origins.set(origin, Object.freeze({ ...entry, players: [] }));
      else active.set(origin, entry);
    }
    return active;
  }
}
