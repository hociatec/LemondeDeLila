import { Inject, Injectable } from '@nestjs/common';
import {
  BUSINESS_CLOCK,
  type BusinessClock,
} from '../../../../../shared/interfaces/public-api';
import { operationalSettings } from '../../../../config/public-api';
import type { RealtimeClientSession } from './realtime-api.types';
import { requestFingerprint } from './realtime-request-fingerprint';

export type RealtimeResponseFrame = Record<string, unknown>;

type ReplayEntry = {
  readonly type: string;
  readonly fingerprint: string;
  expiresAtMs: number;
  readonly result: Promise<readonly RealtimeResponseFrame[]>;
};

export type ReplayResolution =
  | {
      readonly kind: 'execute';
      readonly complete: (frames: readonly RealtimeResponseFrame[]) => void;
      readonly fail: () => void;
    }
  | {
      readonly kind: 'replay';
      readonly frames: Promise<readonly RealtimeResponseFrame[]>;
    }
  | { readonly kind: 'collision' }
  | { readonly kind: 'busy' };

/**
 * Bounded, reconnect-safe replay protection for externally supplied request IDs.
 * Authenticated clients share their replay window across reconnects; anonymous
 * clients are isolated by connection ID.
 */
@Injectable()
export class RealtimeRequestReplayService {
  private readonly entries = new Map<string, ReplayEntry>();
  private readonly ttlMs = operationalSettings.realtimeRequestReplayTtlMs;
  private readonly maxEntries =
    operationalSettings.realtimeRequestReplayMaxEntries;

  constructor(@Inject(BUSINESS_CLOCK) private readonly clock: BusinessClock) {}

  begin(
    session: RealtimeClientSession,
    type: string,
    requestId: string | undefined,
    payload?: unknown,
  ): ReplayResolution {
    if (!requestId) return this.executionWithoutReplay();
    if (typeof type !== 'string' || type.length === 0 || type.length > 128) {
      return { kind: 'collision' };
    }
    this.pruneExpired();
    const key = this.key(session, requestId);
    let fingerprint: string;
    try {
      fingerprint = requestFingerprint(type, payload, session.user?.roles);
    } catch {
      return { kind: 'collision' };
    }
    const existing = this.entries.get(key);
    if (existing) {
      if (existing.fingerprint !== fingerprint) return { kind: 'collision' };
      return { kind: 'replay', frames: existing.result };
    }
    this.enforceBound();
    if (this.entries.size >= this.maxEntries) return { kind: 'busy' };

    let complete!: (frames: readonly RealtimeResponseFrame[]) => void;
    let failPromise!: () => void;
    const result = new Promise<readonly RealtimeResponseFrame[]>((resolve) => {
      complete = resolve;
      failPromise = () => resolve([]);
    });
    const entry: ReplayEntry = {
      type,
      fingerprint,
      expiresAtMs: Infinity,
      result,
    };
    this.entries.set(key, entry);
    return {
      kind: 'execute',
      complete: (frames) => {
        if (entry.expiresAtMs !== Infinity) return;
        if (!Array.isArray(frames) || frames.length > 128) {
          entry.expiresAtMs = this.now() + this.ttlMs;
          complete([]);
          return;
        }
        let snapshot: readonly RealtimeResponseFrame[];
        try {
          const serialized = JSON.stringify(frames);
          if (Buffer.byteLength(serialized, 'utf8') > 1_048_576) {
            entry.expiresAtMs = this.now() + this.ttlMs;
            complete([]);
            return;
          }
          snapshot = structuredClone(frames);
        } catch {
          entry.expiresAtMs = this.now() + this.ttlMs;
          complete([]);
          return;
        }
        entry.expiresAtMs = this.now() + this.ttlMs;
        complete(snapshot);
      },
      fail: () => {
        entry.expiresAtMs = 0;
        if (this.entries.get(key) === entry) this.entries.delete(key);
        failPromise();
      },
    };
  }

  get size(): number {
    this.pruneExpired();
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  private executionWithoutReplay(): ReplayResolution {
    return {
      kind: 'execute',
      complete: () => undefined,
      fail: () => undefined,
    };
  }

  private key(session: RealtimeClientSession, requestId: string): string {
    const actor = session.user?.id
      ? `user:${session.user.id}`
      : `connection:${session.connectionId}`;
    return JSON.stringify([
      actor,
      session.scope ?? 'api',
      session.roomId ?? null,
      session.gameType ?? null,
      requestId,
    ]);
  }

  private pruneExpired(): void {
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAtMs <= now) this.entries.delete(key);
    }
  }

  private enforceBound(): void {
    while (this.entries.size >= this.maxEntries) {
      const completed = [...this.entries].find(
        ([, entry]) => entry.expiresAtMs !== Infinity,
      );
      if (!completed) return;
      this.entries.delete(completed[0]);
    }
  }

  private now(): number {
    return this.clock.now();
  }
}
