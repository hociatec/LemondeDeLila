import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../engine/dto/game-action.dto';
import { GameRegistryService } from '../../../engine/services/game-registry.service';
import { AbstractGameService } from '../../../engine/abstract/abstract-game.service';
import type {
  GameShortcutHint,
  GameShortcutsContext,
} from '../../../engine/shortcuts/game-shortcuts';
import { MINUIT_GAME } from './definitions/minuit.definition';
import { MinuitSetupService } from './setup/minuit-setup.service';
import { MinuitActionService } from './actions/minuit-action.service';
import { MinuitPresenterService } from './presenter/minuit-presenter.service';
import { MinuitBotService } from './bots/minuit-bot.service';
import * as Rulebook from './rulebook/rulebook';
import { buildMinuitShortcuts } from './minuit.shortcuts';

@Injectable()
export class EnAttendantMinuitService extends AbstractGameService
{
  readonly gameType = 'en-attendant-minuit';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = MINUIT_GAME.displayName;
  readonly description = "Course de Noël jusqu'à Minuit.";
  readonly minPlayers = MINUIT_GAME.minPlayers;
  readonly maxPlayers = MINUIT_GAME.maxPlayers;

  constructor(
    registry: GameRegistryService,
    private readonly setup: MinuitSetupService,
    private readonly actions: MinuitActionService,
    private readonly presenter: MinuitPresenterService,
    private readonly bots: MinuitBotService,
  ) {
    super(registry);
  }
  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    return this.setup.hydrateInitialState(baseState);
  }

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    return this.actions.applyActions(state, actions);
  }

  getAvailableActions(
    state: GameStateEntity,
    playerId: number,
  ): GameSingleActionDto[] {
    return Rulebook.getAvailableActions(state, playerId);
  }

  validateAction(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameSingleActionDto {
    return Rulebook.validateAction(state, action, actorId);
  }

  shouldAnnounceBoardArrivals(): boolean {
    return true;
  }

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    return this.bots.getBotActions(state, botPlayerId);
  }

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    return this.presenter.exposeStateForUser(state, userId);
  }

  getShortcuts(ctx: GameShortcutsContext<any>): GameShortcutHint[] {
    return buildMinuitShortcuts(ctx);
  }
}
