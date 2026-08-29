import type { GameSingleActionDto } from '../../models/game-action.model';
import { GameConfigurationError } from '../../../domain/errors/game-domain.errors';

export type SchedulerVisibility =
  | { kind: 'public' }
  | { kind: 'internal' }
  | { kind: 'private'; playerIds: number[] };

export type ScheduledGameTask = {
  id: string;
  dueAtMs: number;
  action?: GameSingleActionDto;
  visibility: SchedulerVisibility;
};

export type GameSchedulerState = {
  tasks: Record<string, ScheduledGameTask>;
};

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
    const dueAtMs =
      options.atMs ?? this.nowMs() + Math.max(0, options.afterMs ?? 0);
    if (!normalizedId || !Number.isFinite(dueAtMs)) {
      throw new GameConfigurationError('Timer de jeu invalide');
    }
    this.state.tasks[normalizedId] = {
      id: normalizedId,
      dueAtMs,
      ...(options.action ? { action: structuredClone(options.action) } : {}),
      visibility: structuredClone(options.visibility ?? { kind: 'public' }),
    };
    this.emit('timer.scheduled', { id: normalizedId, dueAtMs });
  }

  cancel(id: string): boolean {
    if (!this.state.tasks[id]) return false;
    delete this.state.tasks[id];
    this.emit('timer.cancelled', { id });
    return true;
  }

  has(id: string): boolean {
    return this.state.tasks[id] != null;
  }

  deadline(id: string): number | null {
    return this.state.tasks[id]?.dueAtMs ?? null;
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
        left.dueAtMs - right.dueAtMs || left.id.localeCompare(right.id),
    )[0];
  return task ? structuredClone(task) : null;
}

export function projectScheduler(
  state: GameSchedulerState,
  viewerPlayerId: number | null,
  nowMs: number,
): Record<string, { deadlineMs: number; remainingMs: number }> {
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
          },
        ],
      ];
    }),
  );
}
