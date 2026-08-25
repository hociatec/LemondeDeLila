import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import type { GameSingleActionDto } from '../../../../../core/application/models/game-action.model';
import { BotRunnerService } from '../../../../../core/application/services/bot-runner.service';
import * as Rulebook from '../../rulebook/rulebook';

export class ZigEtZagBotService {
  constructor(private readonly botRunner: BotRunnerService) {}

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    const available = Rulebook.getAvailableActions(state, botPlayerId);
    if (!available.length) {
      return [];
    }
    return this.botRunner.choose(
      available,
      { state, playerId: botPlayerId },
      'random',
    );
  }
}


