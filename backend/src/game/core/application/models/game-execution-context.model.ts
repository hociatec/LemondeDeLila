import { nextRngFloat, nextRngInt } from '../../../../shared/utils/public-api';
import type { GameStateEntity, GameStateMetadata } from './game-state.model';

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

export class SystemGameClock implements GameClock {
  nowMs(): number {
    return Date.now();
  }

  nowIso(): string {
    return new Date(this.nowMs()).toISOString();
  }
}

export class FixedGameClock implements GameClock {
  constructor(private currentMs: number) {}

  nowMs(): number {
    return this.currentMs;
  }

  nowIso(): string {
    return new Date(this.currentMs).toISOString();
  }

  advanceBy(milliseconds: number): void {
    this.currentMs += Math.max(0, milliseconds);
  }
}

export class StateGameRng implements GameRng {
  constructor(private readonly state: GameStateEntity) {}

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
