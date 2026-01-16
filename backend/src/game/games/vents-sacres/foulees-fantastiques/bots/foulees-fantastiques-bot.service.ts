import { Injectable } from '@nestjs/common';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { BotRunnerService } from '../../../../modules/bot/services/bot-runner.service';
import * as FouleesFantastiquesRulebook from '../rulebook/rulebook';

@Injectable()
export class FouleesFantastiquesBotService {
  constructor(private readonly botRunner: BotRunnerService) {}

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== botPlayerId) return [];

    const available = FouleesFantastiquesRulebook.getAvailableActions(
      state,
      botPlayerId,
    );
    return this.botRunner.choose(
      available,
      { state, playerId: botPlayerId },
      'random',
      {
        preferTypes: ['choose_family', 'move_pawn', 'roll'],
        fallbackTypes: ['choose_family', 'move_pawn', 'roll'],
      },
    );
  }
}
