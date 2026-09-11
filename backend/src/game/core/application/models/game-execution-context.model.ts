import { nextRngFloat, nextRngInt } from '../random/seeded-rng';
import type { GameState, GameStateMetadata } from './game-state.model';
import { businessMsToIso } from '../../../../shared/utils/public-api';

export type PlayerId = number;

export interface GameClock {
  nowMs(): number;
  nowIso(): string;
}

export interface GameRng {
  next(): number;
  int(maxExclusive: number): number;
  pick<T>(values: readonly T[]): T | null;
  shuffle<T>(values: readonly T[]): T[];
}

export interface GameExecutionContext {
  actorId: PlayerId | null;
  commandId?: string | null;
  rng: GameRng;
  clock: GameClock;
}

export class FixedGameClock implements GameClock {
  constructor(private currentMs: number) {}

  nowMs(): number {
    return this.currentMs;
  }

  nowIso(): string {
    return businessMsToIso(this.currentMs);
  }

  advanceBy(milliseconds: number): void {
    this.currentMs += Math.max(0, milliseconds);
  }
}

export class StateGameRng implements GameRng {
  constructor(private readonly state: GameState) {}

  next(): number {
    const result = nextRngFloat(this.metadata());
    this.state.metadata = result.meta;
    return result.value;
  }

  int(maxExclusive: number): number {
    const result = nextRngInt(this.metadata(), maxExclusive);
    this.state.metadata = result.meta;
    return result.value;
  }

  pick<T>(values: readonly T[]): T | null {
    if (values.length === 0) return null;
    return values[this.int(values.length)] ?? null;
  }

  shuffle<T>(values: readonly T[]): T[] {
    const shuffled = [...values];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const target = this.int(index + 1);
      [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
    }
    return shuffled;
  }

  private metadata(): GameStateMetadata {
    return this.state.metadata ?? {};
  }
}
/** Explicitly named data contract at the application boundary. */
