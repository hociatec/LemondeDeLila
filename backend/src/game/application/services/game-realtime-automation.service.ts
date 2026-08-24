import { Injectable } from '@nestjs/common';
import type { GameRulesAdapter } from '../contracts/game-rules-adapter.interface';
import type { GameSingleActionDto } from '../models/game-action.model';
import type { GameStateEntity } from '../models/game-state.model';
import { BotRunnerService } from './bot-runner.service';
import { BotSchedulerService } from './bot-scheduler.service';
import { BotSettingsService } from './bot-settings.service';
import { GameEngineService } from './game-engine.service';

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

  constructor(
    private readonly engine: GameEngineService,
    private readonly botRunner: BotRunnerService,
    private readonly botScheduler: BotSchedulerService,
    private readonly botSettings: BotSettingsService,
  ) {}

  schedule(input: {
    roomId: number;
    gameType: string;
    handler: GameRulesAdapter;
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

    this.botScheduler.schedule({
      key: timerKey,
      delayMs: plan.delayMs,
      roomId: input.roomId,
      gameType: input.gameType,
      run: async () => {
        if (this.scheduledSignatures.get(timerKey) !== plan.signature) return;
        this.scheduledSignatures.delete(timerKey);
        const current = await this.engine.exportInternalState(
          input.roomId,
          input.gameType,
        );
        if (!current) return;
        const currentPlan = this.resolvePlan(input.handler, current);
        if (!currentPlan) return;
        if (currentPlan.signature !== plan.signature) {
          this.schedule({ ...input, state: current });
          return;
        }
        const next = input.handler.applyActions(current, currentPlan.actions);
        await input.commit(current, next);
      },
    });
  }

  clear(roomId: number, gameType: string): void {
    const timerKey = this.timerKey(roomId, gameType);
    this.scheduledSignatures.delete(timerKey);
    this.botScheduler.clear(timerKey);
  }

  private resolvePlan(
    handler: GameRulesAdapter,
    state: GameStateEntity,
  ): AutomationPlan | null {
    const automatic = handler.getAutomaticActions?.(state) ?? null;
    if (automatic?.actions?.length) {
      const executeAtMs = Number(automatic.executeAtMs ?? Date.now());
      return {
        signature: `automatic:${automatic.key}:${Number(state.turnIndex ?? 0)}`,
        delayMs: Math.max(0, executeAtMs - Date.now()),
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
      signature: `bot:${currentPlayerId}:${Number(state.turnIndex ?? 0)}`,
      delayMs: this.botSettings.getBotTurnDelayMs(),
      actions,
    };
  }

  private timerKey(roomId: number, gameType: string): string {
    return `game-realtime:${roomId}:${gameType}`;
  }
}
