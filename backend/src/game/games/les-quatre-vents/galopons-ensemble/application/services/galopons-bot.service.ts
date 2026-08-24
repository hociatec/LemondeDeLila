import type { GameSingleActionDto } from '../../../../../application/models/game-action.model';
import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import { BotRunnerService } from '../../../../../application/services/bot-runner.service';
import * as Rulebook from '../../rulebook/rulebook';

export class GaloponsBotService {
  constructor(private readonly botRunner: BotRunnerService) {}

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    const currentPlayerId = state.turn?.currentPlayerId ?? null;
    const pendingPlayerId = state.pending?.playerId ?? null;
    const isPendingForBot =
      typeof pendingPlayerId === 'number' && pendingPlayerId === botPlayerId;
    if (currentPlayerId !== botPlayerId && !isPendingForBot) {
      return [];
    }

    const available = Rulebook.getAvailableActions(state, botPlayerId);
    return this.botRunner.choose(
      available,
      { state, playerId: botPlayerId },
      'random',
      {
        preferTypes: ['draw', 'choose_target', 'roll'],
        fallbackTypes: ['draw', 'choose_target', 'roll'],
      },
    );
  }
}



