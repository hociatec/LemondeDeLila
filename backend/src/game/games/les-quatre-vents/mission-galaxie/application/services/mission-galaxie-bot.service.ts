import type { GameSingleActionDto } from '../../../../../core/application/models/game-action.model';
import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import { BotRunnerService } from '../../../../../core/application/services/bot-runner.service';
import * as Rulebook from '../../rulebook/rulebook';

export class MissionGalaxieBotService {
  constructor(private readonly botRunner: BotRunnerService) {}

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    const available = Rulebook.getAvailableActions(state, botPlayerId);
    return this.botRunner.choose(
      available,
      { state, playerId: botPlayerId },
      'random',
      {
        preferTypes: ['draw', 'choose_option', 'choose_event_move', 'roll'],
        fallbackTypes: ['roll', 'draw'],
      },
    );
  }
}



