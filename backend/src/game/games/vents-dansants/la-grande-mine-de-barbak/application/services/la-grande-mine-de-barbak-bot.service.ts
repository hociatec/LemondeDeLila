import type { GameStateEntity } from '../../../../application/models/game-state.model';
import type { GameSingleActionDto } from '../../../../models/game-action.model';
import * as Rulebook from '../../rulebook/rulebook';

export class LaGrandeMineDeBarbakBotService {
  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    const actions = Rulebook.getAvailableActions(state, botPlayerId);
    if (!actions.length) return [];
    const preferred = actions.find((action) => action.type === 'play_card');
    return [preferred ?? actions[0]];
  }
}
