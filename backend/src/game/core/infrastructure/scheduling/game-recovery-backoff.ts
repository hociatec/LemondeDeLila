import type { GameSessionKey } from '../../application/ports/game-session-recovery.reader';

/** Bounded, non-destructive quarantine: SQL remains authoritative and is retried. */
export class GameRecoveryBackoff {
  private readonly failures = new Map<
    string,
    { count: number; retryAt: number; seen: boolean }
  >();

  constructor(private readonly now: () => number = () => performance.now()) {}

  shouldRetry(key: GameSessionKey): boolean {
    const failure = this.failures.get(this.id(key));
    if (failure) failure.seen = true;
    return (failure?.retryAt ?? 0) <= this.now();
  }

  failed(key: GameSessionKey): number {
    const id = this.id(key);
    const count = Math.min(7, (this.failures.get(id)?.count ?? 0) + 1);
    if (!this.failures.has(id) && this.failures.size >= 10_000) {
      const oldest = this.failures.keys().next().value;
      if (oldest !== undefined) this.failures.delete(oldest);
    }
    const delayMs = Math.min(300_000, 5_000 * 2 ** (count - 1));
    this.failures.set(id, { count, retryAt: this.now() + delayMs, seen: true });
    return delayMs;
  }

  recovered(key: GameSessionKey): void {
    this.failures.delete(this.id(key));
  }
  /** Call only after a complete SQL sweep, never after a partial or failed page. */
  completeSweep(): void {
    for (const [id, failure] of this.failures) {
      if (!failure.seen) this.failures.delete(id);
      else failure.seen = false;
    }
  }
  get size(): number {
    return this.failures.size;
  }
  private id(key: GameSessionKey): string {
    return `${key.roomId}:${key.gameType}`;
  }
}
