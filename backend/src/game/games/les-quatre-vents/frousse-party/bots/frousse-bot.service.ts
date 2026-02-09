import { Injectable } from '@nestjs/common';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { BotRunnerService } from '../../../../modules/bot/services/bot-runner.service';
import * as Rulebook from '../rulebook/rulebook';

@Injectable()
export class FrousseBotService {
  constructor(private readonly botRunner: BotRunnerService) {}

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    const available = Rulebook.getAvailableActions(state, botPlayerId);
    const pawnChoices = available.filter(
      (a) => String(a?.type ?? '').toLowerCase() === 'choose_pawn',
    );
    if (pawnChoices.length > 0) {
      const idx = Math.floor(Math.random() * pawnChoices.length);
      const picked = pawnChoices[idx] ?? pawnChoices[0];
      return picked ? [picked] : [];
    }
    return this.botRunner.choose(
      available,
      { state, playerId: botPlayerId },
      'random',
      {
        preferTypes: ['choose_pawn', 'draw', 'choose_target', 'roll'],
        fallbackTypes: ['draw', 'choose_target', 'roll'],
      },
    );
  }
}
