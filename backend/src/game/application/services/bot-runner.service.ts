import { Injectable } from '@nestjs/common';
import { GameSingleActionDto } from '../models/game-action.model';
import { GameStateEntity } from '../models/game-state.model';
import type { GameRulesAdapter } from '../contracts/game-rules-adapter.interface';
import {
  BotDecisionOptions,
  BotProfile,
  BotStrategyService,
} from './bot-strategy.service';

@Injectable()
export class BotRunnerService {
  constructor(private readonly strategy: BotStrategyService) {}

  choose(
    actions: GameSingleActionDto[],
    ctx: { state: GameStateEntity; playerId: number },
    profile: BotProfile = 'greedy',
    opts: BotDecisionOptions = {},
  ): GameSingleActionDto[] {
    return this.strategy.chooseProfile(actions, ctx, profile, opts);
  }

  suggestForHandler(
    handler: GameRulesAdapter | undefined,
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] | null {
    if (!handler) return null;
    if (handler.getBotActions) {
      return handler.getBotActions(state, botPlayerId) ?? null;
    }
    const strategy = handler.getBotStrategy ? handler.getBotStrategy() : null;
    if (strategy?.suggest) {
      return strategy.suggest(state, botPlayerId);
    }
    return null;
  }
}

