import type { GameSingleActionDto } from '../../../../../application/models/game-action.model';
import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import { BotRunnerService } from '../../../../../application/services/bot-runner.service';
import * as Rulebook from '../../rulebook/ca.rulebook';

export class CaBotService {
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
        preferTypes: ['draw', 'choose_target', 'choose_next_player', 'roll'],
        fallbackTypes: ['draw', 'choose_target', 'choose_next_player', 'roll'],
      },
    );
  }
}



