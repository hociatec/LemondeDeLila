import type { GameSingleActionDto } from '../../../../../core/application/models/game-action.model';
import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import { BotRunnerService } from '../../../../../core/application/services/bot-runner.service';
import * as Rulebook from '../../rulebook/rulebook';

export class ContesBotService {
  constructor(private readonly botRunner: BotRunnerService) {}

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    const pendingPlayerId = state.pending?.playerId ?? null;
    const current = state.turn?.currentPlayerId ?? null;
    if (
      current !== botPlayerId &&
      !(typeof pendingPlayerId === 'number' && pendingPlayerId === botPlayerId)
    ) {
      return [];
    }
    const available = Rulebook.getAvailableActions(state, botPlayerId);
    return this.botRunner.choose(
      available,
      { state, playerId: botPlayerId },
      'random',
      {
        preferTypes: [
          'choose_pawn',
          'draw',
          'choose_target',
          'choose_option',
          'choose_number',
          'choose_card',
          'roll',
        ],
        fallbackTypes: [
          'choose_pawn',
          'draw',
          'choose_target',
          'choose_option',
          'choose_number',
          'choose_card',
          'roll',
        ],
      },
    );
  }
}







