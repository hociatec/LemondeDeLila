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

@Injectable()
export class GameRealtimeAutomationService implements OnModuleInit {
  private readonly logger = new Logger(GameRealtimeAutomationService.name);
  private onStateCommitted: AutomaticStateCommittedHandler | null = null;

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
      void this.cancel(key, input.gameType);
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
    void this.scheduler.schedule(task).catch((error: unknown) => {
      this.logger.error(
        this.errorLog('game.task.schedule.failed', task, error),
      );
    });
  }

  clear(roomId: number, gameType: string): void {
    void this.cancel(this.taskKey(roomId, gameType), gameType);
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
    const handler = this.registry?.getHandler(task.gameType);
    if (!handler)
      throw new Error(`Runtime de jeu indisponible: ${task.gameType}`);
    const current = await this.engine.exportInternalState(
      task.roomId,
      task.gameType,
    );
    if (!current || String(current.status).toLowerCase() === 'finished') return;
    const currentPlan = this.resolvePlan(handler, current);
    if (!currentPlan) return;

    // Redis only wakes the engine; persisted state decides whether delivery is valid.
    if (
      Number(current.version ?? 0) !== task.generation ||
      currentPlan.signature !== task.signature
    ) {
      this.schedule({
        roomId: task.roomId,
        gameType: task.gameType,
        handler,
        state: current,
      });
      return;
    }
    // The persisted task owns the deadline. A bot plan is computed from
    // "now + delay", so recomputing and comparing that deadline here would
    // postpone the bot forever each time the worker wakes up.
    if (task.dueAtMs > gameNowMs()) {
      void this.scheduler.schedule(task);
      return;
    }

    const actions = currentPlan.actions.map((action, index) => ({
      ...action,
      meta: {
        ...(action.meta ?? {}),
        commandId: `${task.key}:${task.signature}:${index}`,
      },
    }));
    const next = this.executor.execute({
      handler,
      state: current,
      actions,
      actorId: null,
      roomId: task.roomId,
    });
    this.metrics?.recordAutomaticActions(task.gameType, actions.length);
    const result = await this.engine.compareAndSetInternalState(
      task.roomId,
      task.gameType,
      Number(current.version ?? 0),
      next,
    );
    if (!result.committed) throw new GameStateConflictError();
    const presentedState = structuredClone(next);
    presentedState.version = result.version;
    await this.onStateCommitted?.({
      roomId: task.roomId,
      gameType: task.gameType,
      handler,
      state: presentedState,
      version: result.version,
    });
    this.schedule({
      roomId: task.roomId,
      gameType: task.gameType,
      handler,
      state: result.state,
    });
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

  private errorLog(
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
}
