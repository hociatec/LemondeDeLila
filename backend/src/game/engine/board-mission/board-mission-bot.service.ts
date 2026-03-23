import { Injectable } from '@nestjs/common';
import type { GameSingleActionDto } from '../dto/game-action.dto';
import type { GameStateEntity } from '../../core/entities/game-state.entity';
import { BotRunnerService } from '../../modules/bot/services/bot-runner.service';
import { getBoardMissionAvailableActions } from './board-mission.rulebook';

@Injectable()
export class BoardMissionBotService {
  constructor(private readonly botRunner: BotRunnerService) {}

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    const available = getBoardMissionAvailableActions(state, botPlayerId);
    return this.botRunner.choose(
      available,
      { state, playerId: botPlayerId },
      'random',
      {
        preferTypes: ['roll'],
        fallbackTypes: ['roll'],
      },
    );
  }
}
