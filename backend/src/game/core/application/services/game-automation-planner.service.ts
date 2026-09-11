import { Injectable } from '@nestjs/common';
import type { GameRuntime } from '../ports/game-runtime.port';
import type { GameState } from '../models/game-state.model';
import type { GameSingleActionDto } from '../models/game-action.model';
import { BotRunnerService } from './bot-runner.service';
import { BotSettingsService } from './bot-settings.service';
import { gameNowMs } from './game-execution-scope.service';

export type AutomationPlan = {
  signature: string;
  dueAtMs: number;
  actions: GameSingleActionDto[];
};

/** Selects the next automatic or bot action without scheduling or persisting it. */
@Injectable()
export class GameAutomationPlannerService {
  constructor(
    private readonly botRunner: BotRunnerService,
    private readonly botSettings: BotSettingsService,
  ) {}
  resolve(handler: GameRuntime, state: GameState): AutomationPlan | null {
    const roundCandidate = Number(
      (state as GameState & { engine?: { round?: { number?: number } } }).engine
        ?.round?.number ?? 0,
    );
    const roundNumber =
      Number.isSafeInteger(roundCandidate) && roundCandidate >= 0
        ? roundCandidate
        : 0;
    const automatic = handler.getAutomaticActions(state);
    if (automatic?.actions && automatic.actions.length > 128) return null;
    if (automatic?.actions?.length) {
      const dueCandidate = Number(automatic.executeAtMs ?? gameNowMs());
      const dueAtMs =
        Number.isSafeInteger(dueCandidate) && dueCandidate >= 0
          ? dueCandidate
          : gameNowMs();
      return {
        signature: `automatic:${String(automatic.key).slice(0, 128)}:round:${roundNumber}:turn:${this.safeTurnNumber(state)}`,
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

  private pendingBotPlayerId(state: GameState): number | null {
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
    state: GameState,
    playerId: number,
    roundNumber: number,
    pendingChoice: boolean,
  ): AutomationPlan | null {
    const suggested =
      this.botRunner.suggestForHandler(handler, state, playerId) ?? [];
    if (suggested.length === 0 || suggested.length > 128) return null;
    const rawChoiceId = state.pending?.data?.choiceId;
    const choiceId =
      typeof rawChoiceId === 'string' || typeof rawChoiceId === 'number'
        ? String(rawChoiceId)
        : 'pending';
    const context = pendingChoice ? `choice:${choiceId}` : 'play';
    return {
      signature: `bot:${playerId}:${context.slice(0, 128)}:round:${roundNumber}:turn:${this.safeTurnNumber(state)}`,
      dueAtMs: gameNowMs() + this.botSettings.getBotTurnDelayMs(),
      actions: suggested.map((action) => ({
        ...action,
        meta: { ...(action.meta ?? {}), actorId: playerId },
      })),
    };
  }

  private safeTurnNumber(state: GameState): number {
    const value = Number(state.turn?.turnNumber ?? 0);
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  }
}
