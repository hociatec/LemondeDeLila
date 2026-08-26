import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import type {
  GameClock,
  GameExecutionContext,
} from '../models/game-execution-context.model';
import {
  StateGameRng,
  SystemGameClock,
} from '../models/game-execution-context.model';
import type { GameStateEntity } from '../models/game-state.model';

const executionStorage = new AsyncLocalStorage<GameExecutionContext>();
const systemClock = new SystemGameClock();

export function gameClock(): GameClock {
  return executionStorage.getStore()?.clock ?? systemClock;
}

export function gameNowMs(): number {
  return gameClock().nowMs();
}

export function gameNowIso(): string {
  return gameClock().nowIso();
}

export function gameNowDate(): Date {
  return new Date(gameNowMs());
}

@Injectable()
export class GameExecutionScopeService {
  create(
    state: GameStateEntity,
    actorId: number | null,
    clock: GameClock = systemClock,
    commandId: string | null = null,
  ): GameExecutionContext {
    return { actorId, commandId, rng: new StateGameRng(state), clock };
  }

  run<T>(context: GameExecutionContext, operation: () => T): T {
    return executionStorage.run(context, operation);
  }

  current(): GameExecutionContext | null {
    return executionStorage.getStore() ?? null;
  }
}
