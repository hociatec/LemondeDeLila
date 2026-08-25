import type { GameSingleActionDto } from '../../../../../core/application/models/game-action.model';
import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import { BotRunnerService } from '../../../../../core/application/services/bot-runner.service';
import * as Rulebook from '../../rulebook/rulebook';

export class LesMainsDeLaTerreBotService {
  constructor(private readonly botRunner: BotRunnerService) {}

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    const actions = Rulebook.getAvailableActions(state, botPlayerId);
    if (!actions.length) return [];

    return this.botRunner.choose(
      actions,
      { state, playerId: botPlayerId },
      'greedy',
      {
        preferTypes: ['request_card'],
      },
    );
  }
}




