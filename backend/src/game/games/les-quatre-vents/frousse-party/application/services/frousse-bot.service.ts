import type { GameSingleActionDto } from '../../../../../core/application/models/game-action.model';
import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import { BotRunnerService } from '../../../../../core/application/services/bot-runner.service';
import * as Rulebook from '../../rulebook/rulebook';

export class FrousseBotService {
  constructor(private readonly botRunner: BotRunnerService) {}

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    const available = Rulebook.getAvailableActions(state, botPlayerId);
    const pawnChoices = available.filter(
      (a) => String(a?.type ?? '').toLowerCase() === 'choose_pawn',
    );
    if (pawnChoices.length > 0) {
      const picked = this.botRunner.choose(
        pawnChoices,
        { state, playerId: botPlayerId },
        'random',
      )[0];
      return picked ? [picked] : [];
    }
    return this.botRunner.choose(
      available,
      { state, playerId: botPlayerId },
      'random',
      {
        preferTypes: ['choose_pawn', 'draw', 'choose_target', 'roll'],
        fallbackTypes: ['draw', 'choose_target', 'roll'],
      },
    );
  }
}



