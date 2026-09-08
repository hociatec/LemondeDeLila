import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import type { GameRuntime } from '../contracts/game-runtime.interface';
import type { GameSingleActionDto } from '../contracts/game-action.model';
import type { GameStateEntity } from '../contracts/game-state.model';
import {
  GAME_TASK_SCHEDULER,
  type GameScheduledTask,
  type GameTaskScheduler,
} from '../ports/game-task-scheduler.port';
import { GameStateConflictError } from '../../domain/errors/game-domain.errors';
import { BotRunnerService } from './bot-runner.service';
import { BotSettingsService } from './bot-settings.service';
import { GameCommandExecutorService } from './game-command-executor.service';
import { GameEngineService } from './game-engine.service';
import { GameEngineMetricsService } from './game-engine-metrics.service';
import { gameNowMs } from './game-execution-scope.service';
import { GameRegistryService } from './game-registry.service';
import { GameRoomCommandQueueService } from './game-room-command-queue.service';
import { sameSerializableValue } from '../../../engine/runtime/state/serializable-value';

type AutomationPlan = {
  signature: string;
  dueAtMs: number;
  actions: GameSingleActionDto[];
};

type AutomaticStateCommittedHandler = (input: {
  roomId: number;
  gameType: string;
  handler: GameRuntime;
  state: GameStateEntity;
  version: number;
}) => Promise<void> | void;

type AutomationExecution = {
  handler: GameRuntime;
  current: GameStateEntity;
  plan: AutomationPlan;
};

@Injectable()
export class GameRealtimeAutomationService implements OnModuleInit {
  private readonly logger = new Logger(GameRealtimeAutomationService.name);
  private onStateCommitted: AutomaticStateCommittedHandler | null = null;
  private readonly schedulerOperations = new Map<string, Promise<void>>();

  constructor(
    private readonly engine: GameEngineService,
    private readonly botRunner: BotRunnerService,
    @Inject(GAME_TASK_SCHEDULER)
    private readonly scheduler: GameTaskScheduler,
    private readonly botSettings: BotSettingsService,
    private readonly executor: GameCommandExecutorService,
    private readonly queue: GameRoomCommandQueueService,
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
    state: GameStateEntity;
  }): void {
    const key = this.taskKey(input.roomId, input.gameType);
    const plan = this.resolvePlan(input.handler, input.state);
    if (!plan || String(input.state.status).toLowerCase() === 'finished') {
      this.enqueueSchedulerOperation(key, () =>
        this.cancel(key, input.gameType),
      );
      return;
    }
    const task: GameScheduledTask = {
      key,
      roomId: input.roomId,
      gameType: input.gameType,
      signature: plan.signature,
      generation: Number(input.state.version ?? 0),
      dueAtMs: plan.dueAtMs,
    };
    this.enqueueSchedulerOperation(key, () =>
      this.scheduler.schedule(task).catch((error: unknown) => {
        this.logger.error(
          gameTaskErrorLog('game.task.schedule.failed', task, error),
        );
      }),
    );
  }

  clear(roomId: number, gameType: string): void {
    const key = this.taskKey(roomId, gameType);
    this.enqueueSchedulerOperation(key, () => this.cancel(key, gameType));
  }

  clearRoom(roomId: number): void {
    void this.scheduler.cancelRoom(roomId).catch((error: unknown) => {
      this.logger.error(
        JSON.stringify({
          event: 'game.task.cancel-room.failed',
          roomId,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    });
  }

  async executeTask(task: GameScheduledTask): Promise<void> {
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
    const handler = this.registry?.getHandler(task.gameType);
    if (!handler)
      throw new Error(`Runtime de jeu indisponible: ${task.gameType}`);
    const current = await this.engine.exportInternalState(
      task.roomId,
      task.gameType,
    );
    if (!current || String(current.status).toLowerCase() === 'finished')
      return null;
    const plan = this.resolvePlan(handler, current);
    return plan ? { handler, current, plan } : null;
  }

  private isCurrentTask(
    task: GameScheduledTask,
    execution: AutomationExecution,
  ): boolean {
    return (
      Number(execution.current.version ?? 0) === task.generation &&
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
    this.enqueueSchedulerOperation(task.key, () =>
      this.scheduler.schedule(task).catch((error: unknown) => {
        this.logger.error(
          gameTaskErrorLog('game.task.schedule.failed', task, error),
        );
      }),
    );
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
        commandId: `${task.key}:${task.signature}:generation:${task.generation}:${index}`,
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

  private resolvePlan(
    handler: GameRuntime,
    state: GameStateEntity,
  ): AutomationPlan | null {
    const roundNumber = Number(
      (state as GameStateEntity & { engine?: { round?: { number?: number } } })
        .engine?.round?.number ?? 0,
    );
    const automatic = handler.getAutomaticActions(state);
    if (automatic?.actions?.length) {
      const dueAtMs = Number(automatic.executeAtMs ?? gameNowMs());
      return {
        signature: `automatic:${automatic.key}:round:${roundNumber}:turn:${Number(state.turn?.turnNumber ?? 0)}`,
        dueAtMs,
        actions: automatic.actions,
      };
    }
    const pendingBotPlayerId = this.pendingBotPlayerId(state);
    if (pendingBotPlayerId != null) {
      return this.botPlan(
        handler,
        state,
        pendingBotPlayerId,
        roundNumber,
        true,
      );
    }
    const currentPlayerId = state.turn?.currentPlayerId ?? null;
    const currentPlayer = (state.players ?? []).find(
      (player) => player.id === currentPlayerId,
    );
    if (!currentPlayer?.isBot || currentPlayerId == null) return null;
    return this.botPlan(handler, state, currentPlayerId, roundNumber, false);
  }

  private pendingBotPlayerId(state: GameStateEntity): number | null {
    const pending = state.pending;
    if (!pending) return null;
    const resolved = new Set(pending.resolvedPlayerIds ?? []);
    const expectedPlayerIds = pending.playerIds?.length
      ? pending.playerIds.filter((playerId) => !resolved.has(playerId))
      : pending.playerId == null
        ? []
        : [pending.playerId];
    for (const playerId of expectedPlayerIds) {
      const player = (state.players ?? []).find(
        (candidate) => candidate.id === playerId,
      );
      if (player?.isBot) return playerId;
    }
    return null;
  }

  private botPlan(
    handler: GameRuntime,
    state: GameStateEntity,
    playerId: number,
    roundNumber: number,
    pendingChoice: boolean,
  ): AutomationPlan | null {
    const suggested =
      this.botRunner.suggestForHandler(handler, state, playerId) ?? [];
    if (suggested.length === 0) return null;
    const rawChoiceId = state.pending?.data?.choiceId;
    const choiceId =
      typeof rawChoiceId === 'string' || typeof rawChoiceId === 'number'
        ? String(rawChoiceId)
        : 'pending';
    const context = pendingChoice ? `choice:${choiceId}` : 'play';
    return {
      signature: `bot:${playerId}:${context}:round:${roundNumber}:turn:${Number(state.turn?.turnNumber ?? 0)}`,
      dueAtMs: gameNowMs() + this.botSettings.getBotTurnDelayMs(),
      actions: suggested.map((action) => ({
        ...action,
        meta: { ...(action.meta ?? {}), actorId: playerId },
      })),
    };
  }

  private taskKey(roomId: number, gameType: string): string {
    return `game-realtime:${roomId}:${gameType}`;
  }

  private enqueueSchedulerOperation(
    key: string,
    operation: () => Promise<void>,
  ): void {
    const previous = this.schedulerOperations.get(key);
    const current = previous
      ? previous
          .catch((error: unknown) =>
            this.logSchedulerOperationError(
              key,
              'game.task.scheduler-operation.previous.failed',
              error,
            ),
          )
          .then(operation)
      : operation();
    this.schedulerOperations.set(key, current);
    void current
      .finally(() => {
        if (this.schedulerOperations.get(key) === current) {
          this.schedulerOperations.delete(key);
        }
      })
      .catch((error: unknown) =>
        this.logSchedulerOperationError(
          key,
          'game.task.scheduler-operation.failed',
          error,
        ),
      );
  }

  private async cancel(key: string, gameType: string): Promise<void> {
    try {
      await this.scheduler.cancel(key);
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'game.task.cancel.failed',
          key,
          gameType,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  private logSchedulerOperationError(
    key: string,
    event: string,
    error: unknown,
  ): void {
    this.logger.error(
      JSON.stringify({
        event,
        key,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

function gameTaskErrorLog(
  event: string,
  task: GameScheduledTask,
  error: unknown,
): string {
  return JSON.stringify({
    event,
    key: task.key,
    roomId: task.roomId,
    gameType: task.gameType,
    message: error instanceof Error ? error.message : String(error),
  });
}
