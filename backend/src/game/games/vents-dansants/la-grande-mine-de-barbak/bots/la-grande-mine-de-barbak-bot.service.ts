import { Injectable } from '@nestjs/common';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import * as Rulebook from '../rulebook/rulebook';

@Injectable()
export class LaGrandeMineDeBarbakBotService {
  getBotActions(
    state: any,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    const actions = Rulebook.getAvailableActions(state, botPlayerId);
    if (!actions.length) return [];
    const preferred = actions.find((action) => action.type === 'play_card');
    return [preferred ?? actions[0]];
  }
}
