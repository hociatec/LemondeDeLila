import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../../../core/application/models/game-action.model';
import { AbstractGameService } from '../../../../../core/application/services/abstract-game.service';
import { AVENTURE_SAUVAGE_GAME } from '../../definitions/game.definition';
import { AventureSauvageSetupService } from './aventure-sauvage-setup.service';
import { AventureSauvageActionService } from './aventure-sauvage-action.service';
import { AventureSauvagePresenterService } from './aventure-sauvage-presenter.service';
import { AventureSauvageBotService } from './aventure-sauvage-bot.service';
import * as Rulebook from '../../rulebook/rulebook';
import type {
  GameShortcutHint,
  GameShortcutsContext,
} from '../../../../../shortcuts/public-api';
import { buildAventureSauvageShortcuts } from '../../aventure-sauvage.shortcuts';

export class AventureSauvageService extends AbstractGameService {
  readonly gameType = 'aventure-sauvage';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = AVENTURE_SAUVAGE_GAME.displayName;
  readonly description = "Course en jungle jusqu'à la mare.";
  readonly minPlayers = AVENTURE_SAUVAGE_GAME.minPlayers;
  readonly maxPlayers = AVENTURE_SAUVAGE_GAME.maxPlayers;

  constructor(
    private readonly setup: AventureSauvageSetupService,
    private readonly actions: AventureSauvageActionService,
    private readonly presenter: AventureSauvagePresenterService,
    private readonly bots: AventureSauvageBotService,
  ) {
    super();
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

  getShortcuts(ctx: GameShortcutsContext<unknown>): GameShortcutHint[] {
    return buildAventureSauvageShortcuts(ctx);
  }
}





