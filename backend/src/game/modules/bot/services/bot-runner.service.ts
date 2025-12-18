import { Injectable } from '@nestjs/common';
import { GameSingleActionDto } from '../../../engine/dto/game-action.dto';
import { GameStateEntity } from '../../../core/entities/game-state.entity';
import type { GameRulesAdapter } from '../../../engine/interfaces/game-rules-adapter.interface';
import { BotStrategyService, BotDecisionOptions, BotProfile } from './bot-strategy.service';

@Injectable()
export class BotRunnerService {
  constructor(private readonly strategy: BotStrategyService) {}

  /**
   * Simplifie le choix d'une action : applique le profil, les préférences/fallbacks et retourne 0..1 action.
   */
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
