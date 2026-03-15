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
import { GALOPONS_GAME } from './definitions/galopons.definition';
import { GaloponsSetupService } from './setup/galopons-setup.service';
import { GaloponsActionService } from './actions/galopons-action.service';
import { GaloponsPresenterService } from './presenter/galopons-presenter.service';
import { GaloponsBotService } from './bots/galopons-bot.service';
import * as Rulebook from './rulebook/rulebook';
import { buildGaloponsShortcuts } from './galopons.shortcuts';

@Injectable()
export class GaloponsEnsembleService extends AbstractGameService {
  readonly gameType = 'galopons-ensemble';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = GALOPONS_GAME.displayName;
  readonly description = 'Course équestre avec pommes et cartes.';
  readonly minPlayers = GALOPONS_GAME.minPlayers;
  readonly maxPlayers = GALOPONS_GAME.maxPlayers;

  constructor(
    registry: GameRegistryService,
    private readonly setup: GaloponsSetupService,
    private readonly actions: GaloponsActionService,
    private readonly presenter: GaloponsPresenterService,
    private readonly bots: GaloponsBotService,
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
    return buildGaloponsShortcuts(ctx);
  }

  shouldAnnounceBoardArrivals(): boolean {
    return false;
  }
}
