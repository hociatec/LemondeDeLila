import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../engine/dto/game-action.dto';
import * as Rulebook from '../rulebook/rulebook';

@Injectable()
export class AbsurdissimesBotService {
  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    const available = Rulebook.getAvailableActions(state, botPlayerId);
    if (!available.length) {
      return [];
    }
    const index = Math.floor(Math.random() * available.length);
    return [available[index]];
  }
}
