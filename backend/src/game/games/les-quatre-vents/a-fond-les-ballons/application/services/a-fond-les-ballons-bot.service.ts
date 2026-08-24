import type { GameSingleActionDto } from '../../../../../models/game-action.model';
import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import { BotRunnerService } from '../../../../../application/services/bot-runner.service';
import * as Rulebook from '../../rulebook/rulebook';

export class AFondLesBallonsBotService {
  constructor(private readonly botRunner: BotRunnerService) {}

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    const available = Rulebook.getAvailableActions(state, botPlayerId);
    if (available.length === 0) return [];

    const current = state.turn?.currentPlayerId ?? null;
    const pendingPlayerId = state.pending?.playerId ?? null;
    const isPendingForMe =
      typeof pendingPlayerId === 'number' && pendingPlayerId === botPlayerId;

    if (current !== botPlayerId && !isPendingForMe) return [];

    return this.botRunner.choose(
      available,
      { state, playerId: botPlayerId },
      'random',
      {
        preferTypes: ['choose_pawn', 'draw', 'swap_choose_target', 'roll'],
        fallbackTypes: ['choose_pawn', 'draw', 'swap_choose_target', 'roll'],
      },
    );
  }
}



