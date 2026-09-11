import type { GameSingleActionDto } from '../../../core/application/models/game-action.model';

export type SchedulerVisibility =
  | { kind: 'public' }
  | { kind: 'internal' }
  | { kind: 'private'; playerIds: number[] };

export type ScheduledGameTask = {
  schemaVersion?: 1;
  id: string;
  dueAtMs: number;
  action?: GameSingleActionDto;
  visibility: SchedulerVisibility;
};

export type GameSchedulerState = {
  tasks: Record<string, ScheduledGameTask>;
};
