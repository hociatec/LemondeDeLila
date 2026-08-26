import { Injectable, Optional } from '@nestjs/common';
import type { GameRuntime } from '../contracts/game-runtime.interface';
import type { GameSingleActionDto } from '../models/game-action.model';
import type { GameStateEntity } from '../models/game-state.model';
import { BotRunnerService } from './bot-runner.service';
import { BotSchedulerService } from './bot-scheduler.service';
import { BotSettingsService } from './bot-settings.service';
import { GameEngineService } from './game-engine.service';
import { GameCommandExecutorService } from './game-command-executor.service';
import { gameNowMs } from './game-execution-scope.service';
import { GameEngineMetricsService } from './game-engine-metrics.service';

type AutomationCommit = (
  previous: GameStateEntity,
  next: GameStateEntity,
) => Promise<void>;

type AutomationPlan = {
  signature: string;
  delayMs: number;
  actions: GameSingleActionDto[];
};

@Injectable()
export class GameRealtimeAutomationService {
  private readonly scheduledSignatures = new Map<string, string>();
  private readonly generations = new Map<string, number>();

  constructor(
    private readonly engine: GameEngineService,
    private readonly botRunner: BotRunnerService,
    private readonly botScheduler: BotSchedulerService,
    private readonly botSettings: BotSettingsService,
    private readonly executor: GameCommandExecutorService,
    @Optional() private readonly metrics?: GameEngineMetricsService,
  ) {}

  schedule(input: {
    roomId: number;
    gameType: string;
    handler: GameRuntime;
    state: GameStateEntity;
    commit: AutomationCommit;
  }): void {
    const timerKey = this.timerKey(input.roomId, input.gameType);
    const plan = this.resolvePlan(input.handler, input.state);
    if (!plan) {
      this.clear(input.roomId, input.gameType);
      return;
    }
    if (
      this.scheduledSignatures.get(timerKey) === plan.signature &&
      this.botScheduler.has(timerKey)
    ) {
      return;
    }

    this.botScheduler.clear(timerKey);
    this.scheduledSignatures.set(timerKey, plan.signature);
    const generation = this.generations.get(timerKey) ?? 0;
    this.generations.set(timerKey, generation);

    this.botScheduler.schedule({
      key: timerKey,
      delayMs: plan.delayMs,
      roomId: input.roomId,
      gameType: input.gameType,
      run: async () => {
        if ((this.generations.get(timerKey) ?? 0) !== generation) return;
        if (this.scheduledSignatures.get(timerKey) !== plan.signature) return;
        this.scheduledSignatures.delete(timerKey);
        const current = await this.engine.exportInternalState(
          input.roomId,
          input.gameType,
        );
        if ((this.generations.get(timerKey) ?? 0) !== generation) return;
        if (!current) return;
        const currentPlan = this.resolvePlan(input.handler, current);
        if (!currentPlan) return;
        if (currentPlan.signature !== plan.signature) {
          this.schedule({ ...input, state: current });
          return;
        }
        const next = this.executor.execute({
          handler: input.handler,
          state: current,
          actions: currentPlan.actions,
          actorId: null,
          roomId: input.roomId,
        });
        this.metrics?.recordAutomaticActions(
          input.gameType,
          currentPlan.actions.length,
        );
        if ((this.generations.get(timerKey) ?? 0) !== generation) return;
        await input.commit(current, next);
        if ((this.generations.get(timerKey) ?? 0) !== generation) {
          await this.engine.clearInternalStateIf(
            input.roomId,
            input.gameType,
            next,
          );
        }
      },
    });
  }

  clear(roomId: number, gameType: string): void {
    const timerKey = this.timerKey(roomId, gameType);
    this.generations.set(timerKey, (this.generations.get(timerKey) ?? 0) + 1);
    this.scheduledSignatures.delete(timerKey);
    this.botScheduler.clear(timerKey);
  }

  clearRoom(roomId: number): void {
    const prefix = `game-realtime:${roomId}:`;
    const keys = new Set([
      ...this.scheduledSignatures.keys(),
      ...this.generations.keys(),
    ]);
    for (const key of keys) {
      if (!key.startsWith(prefix)) continue;
      this.generations.set(key, (this.generations.get(key) ?? 0) + 1);
      this.scheduledSignatures.delete(key);
      this.botScheduler.clear(key);
    }
  }

  private resolvePlan(
    handler: GameRuntime,
    state: GameStateEntity,
  ): AutomationPlan | null {
    const automatic = handler.getAutomaticActions(state);
    if (automatic?.actions?.length) {
      const executeAtMs = Number(automatic.executeAtMs ?? gameNowMs());
      return {
        signature: `automatic:${automatic.key}:${Number(state.turn?.turnNumber ?? 0)}`,
        delayMs: Math.max(0, executeAtMs - gameNowMs()),
        actions: automatic.actions,
      };
    }

    const currentPlayerId = state.turn?.currentPlayerId ?? null;
    const currentPlayer = (state.players ?? []).find(
      (player) => player.id === currentPlayerId,
    );
    if (!currentPlayer?.isBot || currentPlayerId == null) return null;
    const suggested =
      this.botRunner.suggestForHandler(handler, state, currentPlayerId) ?? [];
    if (suggested.length === 0) return null;
    const actions = suggested.map((action) => ({
      ...action,
      meta: { ...(action.meta ?? {}), actorId: currentPlayerId },
    }));
    return {
      signature: `bot:${currentPlayerId}:${Number(state.turn?.turnNumber ?? 0)}`,
      delayMs: this.botSettings.getBotTurnDelayMs(),
      actions,
    };
  }

  private timerKey(roomId: number, gameType: string): string {
    return `game-realtime:${roomId}:${gameType}`;
  }
}
