import { Injectable } from '@nestjs/common';
import { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { BotRunnerService } from '../../../../modules/bot/services/bot-runner.service';
import { LoupGarouActionService } from '../actions/loup-garou-action.service';
import { LoupGarouSetupService } from '../setup/loup-garou-setup.service';
import { LOUP_GAROU_GAME } from '../definitions/game.definition';

@Injectable()
export class LoupGarouBotService {
  constructor(
    private readonly botRunner: BotRunnerService,
    private readonly actions: LoupGarouActionService,
    private readonly setup: LoupGarouSetupService,
  ) {}

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== botPlayerId) return [];
    const meta = this.setup.metadataOf(state);
    const profile = meta.botProfile ?? 'greedy';
    const actions = this.actions.getAvailableActions(state, botPlayerId);
    const step = meta.step;
    const prefer = (LOUP_GAROU_GAME.botPreferTypesByStep as any)[step] ?? [];
    return this.botRunner.choose(
      actions,
      { state, playerId: botPlayerId },
      profile,
      {
        preferTypes: prefer,
        fallbackTypes: ['day_vote', 'roll'],
      },
    );
  }
}
