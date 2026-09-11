import type { GameSingleActionDto } from '../../../core/application/models/game-action.model';
import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import { gameDeadline, isGameDelay, isGameTimestamp } from './game-deadline';
import type {
  GameSchedulerState,
  ScheduledGameTask,
  SchedulerVisibility,
} from './scheduler-types';
import {
  assertScheduledTask,
  SCHEDULED_TASK_SCHEMA_VERSION,
} from './scheduler-contracts';

export type {
  GameSchedulerState,
  ScheduledGameTask,
  SchedulerVisibility,
} from './scheduler-types';

export function createGameSchedulerState(): GameSchedulerState {
  return { tasks: {} };
}

export class GameSchedulerController {
  constructor(
    private readonly state: GameSchedulerState,
    private readonly nowMs: () => number,
    private readonly emit: (
      type: string,
      data: Record<string, unknown>,
    ) => void = () => {},
  ) {}

  schedule(
    id: string,
    options: {
      afterMs?: number;
      atMs?: number;
      action?: GameSingleActionDto;
      visibility?: SchedulerVisibility;
    },
  ): void {
    const normalizedId = id.trim();
    if (options.afterMs !== undefined && !isGameDelay(options.afterMs)) {
      throw new GameConfigurationError('Durée de timer invalide');
    }
    const dueAtMs =
      options.atMs ?? gameDeadline(this.nowMs(), options.afterMs ?? 0);
    if (!normalizedId || !isGameTimestamp(dueAtMs)) {
      throw new GameConfigurationError('Timer de jeu invalide');
    }
    const task: ScheduledGameTask = {
      schemaVersion: SCHEDULED_TASK_SCHEMA_VERSION,
      id: normalizedId,
      dueAtMs,
      ...(options.action !== undefined ? { action: options.action } : {}),
      visibility: options.visibility ?? { kind: 'public' },
    };
    assertScheduledTask(task, normalizedId);
    Object.defineProperty(this.state.tasks, normalizedId, {
      value: structuredClone(task),
      enumerable: true,
      writable: true,
      configurable: true,
    });
    this.emit('timer.scheduled', { id: normalizedId, dueAtMs });
  }

  cancel(id: string): boolean {
    if (!this.has(id)) return false;
    delete this.state.tasks[id];
    this.emit('timer.cancelled', { id });
    return true;
  }

  has(id: string): boolean {
    return Object.hasOwn(this.state.tasks, id);
  }

  deadline(id: string): number | null {
    return this.has(id) ? this.state.tasks[id].dueAtMs : null;
  }

  remaining(id: string): number | null {
    const deadline = this.deadline(id);
    return deadline == null ? null : Math.max(0, deadline - this.nowMs());
  }

  isDue(id: string): boolean {
    const deadline = this.deadline(id);
    return deadline != null && this.nowMs() >= deadline;
  }

  consume(id: string): boolean {
    if (!this.isDue(id)) return false;
    delete this.state.tasks[id];
    this.emit('timer.fired', { id });
    return true;
  }
}

export function nextScheduledAction(
  state: GameSchedulerState,
): ScheduledGameTask | null {
  const task = Object.values(state.tasks)
    .filter((candidate) => candidate.action != null)
    .sort(
      (left, right) =>
        left.dueAtMs - right.dueAtMs ||
        (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
    )[0];
  return task ? structuredClone(task) : null;
}

export function projectScheduler(
  state: GameSchedulerState,
  viewerPlayerId: number | null,
  nowMs: number,
): Record<
  string,
  { deadlineMs: number; remainingMs: number; actionType?: string }
> {
  return Object.fromEntries(
    Object.values(state.tasks).flatMap((task) => {
      if (task.visibility.kind === 'internal') return [];
      if (
        task.visibility.kind === 'private' &&
        (viewerPlayerId == null ||
          !task.visibility.playerIds.includes(viewerPlayerId))
      ) {
        return [];
      }
      return [
        [
          task.id,
          {
            deadlineMs: task.dueAtMs,
            remainingMs: Math.max(0, task.dueAtMs - nowMs),
            ...(task.action?.type ? { actionType: task.action.type } : {}),
          },
        ],
      ];
    }),
  );
}
