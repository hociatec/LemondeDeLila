import {
  GameAutomationPlannerService,
  type AutomationPlan,
} from './game-automation-planner.service';
import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import {
  GAME_ROOM_RUN_READER,
  type GameRoomRunReader,
} from '../ports/game-room-run-reader.port';
import type { GameRuntime } from '../ports/game-runtime.port';
import { GameTaskDispatchService } from './game-task-dispatch.service';
import type { GameState } from '../models/game-state.model';
import type { GameScheduledTask } from '../ports/game-task-scheduler.port';
import { GameStateConflictError } from '../../domain/errors/game-domain.errors';
import { GameCommandExecutorService } from './game-command-executor.service';
import { GameEngineService } from './game-engine.service';
import { GameEngineMetricsService } from './game-engine-metrics.service';
import { gameNowMs } from './game-execution-scope.service';
import { GameRegistryService } from './game-registry.service';
import { GameRoomCommandQueueService } from './game-room-command-queue.service';
import { sameSerializableValue } from '../../../engine/runtime/state/serializable-value';
import {
  decodeGameScheduledTask,
  gameTaskCommandId,
  gameTaskStateIdentity,
  sameGameTaskStateIdentity,
} from '../helpers/game-task-contract';

type AutomaticStateCommittedHandler = (input: {
  roomId: number;
  gameType: string;
  handler: GameRuntime;
  state: GameState;
  version: number;
}) => Promise<void> | void;

type AutomationExecution = {
  handler: GameRuntime;
  current: GameState;
  plan: AutomationPlan;
};

/** Coordinates durable automation delivery, stale-task checks and state commits. */
@Injectable()
export class GameRealtimeAutomationService implements OnModuleInit {
  private readonly logger = new Logger(GameRealtimeAutomationService.name);
  private onStateCommitted: AutomaticStateCommittedHandler | null = null;

  constructor(
    private readonly engine: GameEngineService,
    private readonly planner: GameAutomationPlannerService,
    private readonly scheduler: GameTaskDispatchService,
    private readonly executor: GameCommandExecutorService,
    private readonly queue: GameRoomCommandQueueService,
    @Inject(GAME_ROOM_RUN_READER) private readonly rooms: GameRoomRunReader,
    @Optional() private readonly metrics?: GameEngineMetricsService,
    @Optional() private readonly registry?: GameRegistryService,
  ) {}

  onModuleInit(): void {
    this.scheduler.registerProcessor((task) => this.executeTask(task));
  }

  setStateCommittedHandler(handler: AutomaticStateCommittedHandler): void {
    this.onStateCommitted = handler;
  }

  schedule(input: {
    roomId: number;
    gameType: string;
    handler: GameRuntime;
    state: GameState;
  }): void {
    if (
      !Number.isSafeInteger(input.roomId) ||
      input.roomId <= 0 ||
      typeof input.gameType !== 'string' ||
      !input.gameType ||
      input.gameType.length > 128
    )
      return;
    const key = this.taskKey(input.roomId, input.gameType);
    const plan = this.planner.resolve(input.handler, input.state);
    if (!plan || String(input.state.status).toLowerCase() === 'finished') {
      this.scheduler.cancel(key, input.gameType);
      return;
    }
    const task: GameScheduledTask = {
      key,
      roomId: input.roomId,
      gameType: input.gameType,
      signature: plan.signature,
      generation:
        Number.isSafeInteger(Number(input.state.version ?? 0)) &&
        Number(input.state.version ?? 0) > 0
          ? Number(input.state.version)
          : 1,
      restoreId: input.state.metadata?.restoreId ?? null,
      stateIdentity: gameTaskStateIdentity(input.state),
      roomRunId: input.state.metadata?.roomRunId ?? null,
      dueAtMs: plan.dueAtMs,
    };
    this.scheduler.schedule(task);
  }

  clear(roomId: number, gameType: string): void {
    if (
      !Number.isSafeInteger(roomId) ||
      roomId <= 0 ||
      typeof gameType !== 'string' ||
      !gameType ||
      gameType.length > 128
    )
      return;
    const key = this.taskKey(roomId, gameType);
    this.scheduler.cancel(key, gameType);
  }

  clearRoom(roomId: number): void {
    this.scheduler.cancelRoom(roomId);
  }

  async executeTask(task: GameScheduledTask): Promise<void> {
    task = decodeGameScheduledTask(task);
    return this.queue.run(task.roomId, () => this.executeTaskInRoom(task));
  }

  private async executeTaskInRoom(task: GameScheduledTask): Promise<void> {
    const execution = await this.resolveExecution(task);
    if (!execution) return;
    if (!this.isCurrentTask(task, execution)) {
      this.scheduleCurrentState(task, execution);
      return;
    }
    if (this.rescheduleFutureTask(task)) return;
    await this.commitAutomation(task, execution);
  }

  private async resolveExecution(
    task: GameScheduledTask,
  ): Promise<AutomationExecution | null> {
    const current = await this.engine.exportInternalState(
      task.roomId,
      task.gameType,
    );
    if (!current || String(current.status).toLowerCase() === 'finished')
      return null;
    if (
      !(await this.rooms.isCurrent(
        task.roomId,
        task.gameType,
        current.metadata?.roomRunId ?? null,
      ))
    )
      return null;
    const handler = this.registry?.getHandler(task.gameType);
    if (!handler)
      throw new Error(`Runtime de jeu indisponible: ${task.gameType}`);
    const plan = this.planner.resolve(handler, current);
    return plan ? { handler, current, plan } : null;
  }

  private isCurrentTask(
    task: GameScheduledTask,
    execution: AutomationExecution,
  ): boolean {
    return (
      Number.isSafeInteger(Number(execution.current.version ?? 0)) &&
      Number(execution.current.version ?? 0) === task.generation &&
      sameGameTaskStateIdentity(task, execution.current) &&
      (execution.current.metadata?.restoreId ?? null) ===
        (task.restoreId ?? null) &&
      (execution.current.metadata?.roomRunId ?? null) ===
        (task.roomRunId ?? null) &&
      execution.plan.signature === task.signature
    );
  }

  private scheduleCurrentState(
    task: GameScheduledTask,
    execution: AutomationExecution,
  ): void {
    this.schedule({
      roomId: task.roomId,
      gameType: task.gameType,
      handler: execution.handler,
      state: execution.current,
    });
  }

  private rescheduleFutureTask(task: GameScheduledTask): boolean {
    // Recomputing a bot deadline from now would postpone execution indefinitely.
    if (task.dueAtMs <= gameNowMs()) return false;
    this.scheduler.schedule(task);
    return true;
  }

  private async commitAutomation(
    task: GameScheduledTask,
    execution: AutomationExecution,
  ): Promise<void> {
    const actions = execution.plan.actions.map((action, index) => ({
      ...action,
      meta: {
        ...(action.meta ?? {}),
        commandId: gameTaskCommandId(task, index),
      },
    }));
    const next = this.executor.execute({
      handler: execution.handler,
      state: execution.current,
      actions,
      actorId: null,
      roomId: task.roomId,
    });
    if (sameSerializableValue(execution.current, next)) {
      this.logNoopAutomation(task);
      return;
    }
    this.metrics?.recordAutomaticActions(task.gameType, actions.length);
    const result = await this.engine.compareAndSetInternalState(
      task.roomId,
      task.gameType,
      Number(execution.current.version ?? 0),
      next,
      execution.current.metadata?.restoreId ?? null,
    );
    if (!result.committed) throw new GameStateConflictError();
    const presentedState = structuredClone(next);
    presentedState.version = result.version;
    await this.onStateCommitted?.({
      roomId: task.roomId,
      gameType: task.gameType,
      handler: execution.handler,
      state: presentedState,
      version: result.version,
    });
    this.schedule({
      roomId: task.roomId,
      gameType: task.gameType,
      handler: execution.handler,
      state: result.state,
    });
  }

  private logNoopAutomation(task: GameScheduledTask): void {
    this.logger.warn(
      JSON.stringify({
        event: 'game.automation.noop',
        key: task.key,
        roomId: task.roomId,
        gameType: task.gameType,
        signature: task.signature,
        generation: task.generation,
      }),
    );
  }

  private taskKey(roomId: number, gameType: string): string {
    return `game-realtime:${roomId}:${gameType}`;
  }
}
