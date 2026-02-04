import { Injectable } from '@nestjs/common';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { BotRunnerService } from '../../../../modules/bot/services/bot-runner.service';
import * as Rulebook from '../rulebook/rulebook';

@Injectable()
export class LesMainsDeLaTerreBotService {
  constructor(private readonly botRunner: BotRunnerService) {}

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    const actions = Rulebook.getAvailableActions(state, botPlayerId);
    if (!actions.length) return [];

    return this.botRunner.choose(
      actions,
      { state, playerId: botPlayerId },
      'greedy',
      {
        preferTypes: ['request_card'],
      },
    );
  }
}
