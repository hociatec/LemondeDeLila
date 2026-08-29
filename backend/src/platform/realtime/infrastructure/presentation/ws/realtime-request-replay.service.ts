import { Injectable } from '@nestjs/common';
import type { RealtimeClientSession } from './realtime-api.types';

export type RealtimeResponseFrame = Record<string, unknown>;

type ReplayEntry = {
  readonly type: string;
  readonly expiresAtMs: number;
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
  | { readonly kind: 'collision' };

/**
 * Bounded, reconnect-safe replay protection for externally supplied request IDs.
 * Authenticated clients share their replay window across reconnects; anonymous
 * clients are isolated by connection ID.
 */
@Injectable()
export class RealtimeRequestReplayService {
  private readonly entries = new Map<string, ReplayEntry>();
  private readonly ttlMs = 5 * 60_000;
  private readonly maxEntries = 10_000;

  begin(
    session: RealtimeClientSession,
    type: string,
    requestId: string | undefined,
  ): ReplayResolution {
    if (!requestId) return this.executionWithoutReplay();
    this.pruneExpired();
    const key = this.key(session, requestId);
    const existing = this.entries.get(key);
    if (existing) {
      if (existing.type !== type) return { kind: 'collision' };
      return { kind: 'replay', frames: existing.result };
    }

    let complete!: (frames: readonly RealtimeResponseFrame[]) => void;
    let failPromise!: () => void;
    const result = new Promise<readonly RealtimeResponseFrame[]>((resolve) => {
      complete = resolve;
      failPromise = () => resolve([]);
    });
    this.entries.set(key, {
      type,
      expiresAtMs: Date.now() + this.ttlMs,
      result,
    });
    this.enforceBound();
    return {
      kind: 'execute',
      complete,
      fail: () => {
        this.entries.delete(key);
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
    return `${actor}:${session.scope ?? 'api'}:${requestId}`;
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAtMs <= now) this.entries.delete(key);
    }
  }

  private enforceBound(): void {
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (!oldest) return;
      this.entries.delete(oldest);
    }
  }
}
