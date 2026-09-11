import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import type {
  GameClock,
  GameExecutionContext,
} from '../models/game-execution-context.model';
import { StateGameRng } from '../models/game-execution-context.model';
import { SystemGameClock } from '@platform/time/public-api';
import { businessMsToDate } from '@shared/utils/public-api';
import type { GameState } from '../models/game-state.model';

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
  return businessMsToDate(gameNowMs());
}

@Injectable()
export class GameExecutionScopeService {
  create(
    state: GameState,
    actorId: number | null,
    clock: GameClock = systemClock,
    commandId: string | null = null,
  ): GameExecutionContext {
    if (actorId !== null && (!Number.isSafeInteger(actorId) || actorId === 0)) {
      actorId = null;
    }
    if (
      commandId !== null &&
      (typeof commandId !== 'string' || commandId.length > 128)
    ) {
      commandId = null;
    }
    return { actorId, commandId, rng: new StateGameRng(state), clock };
  }

  run<T>(context: GameExecutionContext, operation: () => T): T {
    return executionStorage.run(context, operation);
  }

  current(): GameExecutionContext | null {
    return executionStorage.getStore() ?? null;
  }
}
