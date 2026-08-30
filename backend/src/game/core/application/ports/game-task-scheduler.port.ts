export const GAME_TASK_SCHEDULER = Symbol('GAME_TASK_SCHEDULER');

export type GameScheduledTask = {
  key: string;
  roomId: number;
  gameType: string;
  signature: string;
  generation: number;
  dueAtMs: number;
  correlationId?: string;
};

export type GameTaskProcessor = (task: GameScheduledTask) => Promise<void>;

/** Infrastructure wake-up mechanism. The persisted game state remains authoritative. */
export interface GameTaskScheduler {
  registerProcessor(processor: GameTaskProcessor): void;
  schedule(task: GameScheduledTask): Promise<void>;
  cancel(key: string): Promise<void>;
  cancelRoom(roomId: number): Promise<void>;
}
