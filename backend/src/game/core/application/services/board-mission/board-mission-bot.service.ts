import { Injectable } from '@nestjs/common';
import type { GameSingleActionDto } from '../../models/game-action.model';
import type { GameStateEntity } from '../../models/game-state.model';
import { BotRunnerService } from '../bot-runner.service';
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




