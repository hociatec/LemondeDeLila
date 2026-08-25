import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import type { GameSingleActionDto } from '../../../../../core/application/models/game-action.model';
import { BotRunnerService } from '../../../../../core/application/services/bot-runner.service';
import * as AventureSauvageRulebook from '../../rulebook/rulebook';
export class AventureSauvageBotService {
  constructor(private readonly botRunner: BotRunnerService) {}

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== botPlayerId) return [];

    const available = AventureSauvageRulebook.getAvailableActions(
      state,
      botPlayerId,
    );
    return this.botRunner.choose(
      available,
      { state, playerId: botPlayerId },
      'random',
      {
        preferTypes: ['draw', 'roll'],
        fallbackTypes: ['draw', 'roll'],
      },
    );
  }
}



