import { Injectable } from '@nestjs/common';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { BotRunnerService } from '../../../../modules/bot/services/bot-runner.service';
import type { NawakMetadata } from '../model/nawak-state.entity';
import * as Rulebook from '../rulebook/rulebook';

@Injectable()
export class NawakBotService {
  constructor(private readonly botRunner: BotRunnerService) {}

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    const meta = (state.metadata ?? {}) as NawakMetadata;
    const stage = meta.roundStage ?? 'choose';
    const preferTypes = stage === 'choose' ? ['choose_answer'] : ['vote_answer'];
    const fallbackTypes = stage === 'choose' ? ['vote_answer'] : ['choose_answer'];
    const actions = Rulebook.getAvailableActions(state, botPlayerId);
    if (!actions.length) return [];

    return this.botRunner.choose(
      actions,
      { state, playerId: botPlayerId },
      'random',
      { preferTypes, fallbackTypes },
    );
  }
}
