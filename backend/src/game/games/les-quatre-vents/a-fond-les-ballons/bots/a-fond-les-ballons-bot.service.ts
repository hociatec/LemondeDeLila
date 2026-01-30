import { Injectable } from '@nestjs/common';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { BotRunnerService } from '../../../../modules/bot/services/bot-runner.service';
import * as Rulebook from '../rulebook/rulebook';

@Injectable()
export class AFondLesBallonsBotService {
  constructor(private readonly botRunner: BotRunnerService) {}

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    const available = Rulebook.getAvailableActions(state, botPlayerId);
    if (available.length === 0) return [];

    const current = state.turn?.currentPlayerId ?? null;
    const isPendingForMe = !!(state.pending as any)?.playerId && (state.pending as any).playerId === botPlayerId;

    if (current !== botPlayerId && !isPendingForMe) return [];

    return this.botRunner.choose(
      available,
      { state, playerId: botPlayerId },
      'random',
      {
        preferTypes: ['draw', 'swap_choose_target', 'roll'],
        fallbackTypes: ['draw', 'swap_choose_target', 'roll'],
      },
    );
  }
}
