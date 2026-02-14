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
import { A_FOND_LES_BALLONS_GAME } from './definitions/game.definition';
import { AFondLesBallonsSetupService } from './setup/a-fond-les-ballons-setup.service';
import { AFondLesBallonsActionService } from './actions/a-fond-les-ballons-action.service';
import { AFondLesBallonsPresenterService } from './presenter/a-fond-les-ballons-presenter.service';
import { AFondLesBallonsBotService } from './bots/a-fond-les-ballons-bot.service';
import * as Rulebook from './rulebook/rulebook';
import { buildAFondLesBallonsShortcuts } from './a-fond-les-ballons.shortcuts';

@Injectable()
export class AFondLesBallonsService extends AbstractGameService {
  readonly gameType = 'a-fond-les-ballons';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = A_FOND_LES_BALLONS_GAME.displayName;
  readonly description = "Course déjantée jusqu'à la Grosse Noix Dorée.";
  readonly minPlayers = A_FOND_LES_BALLONS_GAME.minPlayers;
  readonly maxPlayers = A_FOND_LES_BALLONS_GAME.maxPlayers;

  constructor(
    registry: GameRegistryService,
    private readonly setup: AFondLesBallonsSetupService,
    private readonly actions: AFondLesBallonsActionService,
    private readonly presenter: AFondLesBallonsPresenterService,
    private readonly bots: AFondLesBallonsBotService,
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
    return buildAFondLesBallonsShortcuts(ctx);
  }
}
