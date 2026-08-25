import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import type { GameSingleActionDto } from '../../../../../core/application/models/game-action.model';
import { BotRunnerService } from '../../../../../core/application/services/bot-runner.service';
import * as Rulebook from '../../rulebook/rulebook';

export class CatPattesBotService {
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
        preferTypes: ['draw', 'play_card', 'discard_card'],
        fallbackTypes: ['draw', 'play_card', 'discard_card', 'pass'],
      },
    );
  }
}



