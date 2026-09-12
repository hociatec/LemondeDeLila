import { Inject, Injectable, Logger } from '@nestjs/common';
import { ApplicationShutdownService } from '../../../../platform/lifecycle/public-api';
import {
  GAME_TASK_SCHEDULER,
  type GameScheduledTask,
  type GameTaskProcessor,
  type GameTaskScheduler,
} from '../ports/game-task-scheduler.port';

/** Serializes scheduler writes per task key and keeps them in the shutdown drain. */
@Injectable()
export class GameTaskDispatchService {
  private readonly logger = new Logger(GameTaskDispatchService.name);
  private readonly operations = new Map<string, Promise<void>>();

  constructor(
    @Inject(GAME_TASK_SCHEDULER) private readonly scheduler: GameTaskScheduler,
    @Inject(ApplicationShutdownService)
    private readonly shutdown = new ApplicationShutdownService(),
  ) {}

  registerProcessor(processor: GameTaskProcessor): void {
    this.scheduler.registerProcessor(processor);
  }

  schedule(task: GameScheduledTask): void {
    if (
      !task ||
      typeof task.key !== 'string' ||
      !task.key ||
      task.key.length > 256
    )
      return;
    this.enqueue(task.key, () =>
      this.scheduler.schedule(task).catch((error: unknown) => {
        this.report(
          'game.task.schedule.failed',
          { key: task.key, roomId: task.roomId, gameType: task.gameType },
          error,
        );
      }),
    );
  }

  cancel(key: string, gameType: string): void {
    if (typeof key !== 'string' || !key || key.length > 256) return;
    this.enqueue(key, () =>
      this.scheduler.cancel(key).catch((error: unknown) => {
        this.report('game.task.cancel.failed', { key, gameType }, error);
      }),
    );
  }

  cancelRoom(roomId: number): void {
    if (!Number.isSafeInteger(roomId) || roomId <= 0) return;
    void this.shutdown
      .run(() => this.scheduler.cancelRoom(roomId), true)
      .catch((error: unknown) => {
        this.report('game.task.cancel-room.failed', { roomId }, error);
      });
  }

  private enqueue(key: string, operation: () => Promise<void>): void {
    if (typeof key !== 'string' || !key || key.length > 256) return;
    const previous = this.operations.get(key);
    const current = this.shutdown.run(
      () =>
        previous
          ? previous
              .catch((error: unknown) =>
                this.report(
                  'game.task.scheduler-operation.previous.failed',
                  { key },
                  error,
                ),
              )
              .then(operation)
          : operation(),
      true,
    );
    this.operations.set(key, current);
    void current
      .finally(() => {
        if (this.operations.get(key) === current) this.operations.delete(key);
      })
      .catch((error: unknown) =>
        this.report('game.task.scheduler-operation.failed', { key }, error),
      );
  }

  private report(
    event: string,
    details: Record<string, unknown>,
    error: unknown,
  ): void {
    this.logger.error(
      JSON.stringify({
        event,
        ...details,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
