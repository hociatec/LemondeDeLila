import type { GameSingleActionDto } from '../../../../../application/models/game-action.model';
import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import { BotRunnerService } from '../../../../../application/services/bot-runner.service';
import * as FouleesFantastiquesRulebook from '../../rulebook/rulebook';

export class FouleesFantastiquesBotService {
  constructor(private readonly botRunner: BotRunnerService) {}

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== botPlayerId) return [];

    const available = FouleesFantastiquesRulebook.getAvailableActions(
      state,
      botPlayerId,
    );
    return this.botRunner.choose(
      available,
      { state, playerId: botPlayerId },
      'random',
      {
        preferTypes: ['choose_family', 'move_pawn', 'roll'],
        fallbackTypes: ['choose_family', 'move_pawn', 'roll'],
      },
    );
  }
}



