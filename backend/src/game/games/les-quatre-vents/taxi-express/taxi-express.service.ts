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
import { TaxiExpressActionService } from './actions/taxi-express-action.service';
import { TaxiExpressPresenterService } from './presenter/taxi-express-presenter.service';
import { TaxiExpressSetupService } from './setup/taxi-express-setup.service';
import { TaxiExpressBotService } from './bots/taxi-express-bot.service';
import * as Rulebook from './rulebook/rulebook';
import { buildTaxiExpressShortcuts } from './shortcuts/taxi-express.shortcuts';
import { TAXI_EXPRESS_GAME } from './definitions/taxi-express.definition';

@Injectable()
export class TaxiExpressService extends AbstractGameService {
  readonly gameType = TAXI_EXPRESS_GAME.id;
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = TAXI_EXPRESS_GAME.displayName;
  readonly description =
    'Transportez vos clients en évitant les événements et validez cinq trajets complets.';
  readonly minPlayers = TAXI_EXPRESS_GAME.minPlayers;
  readonly maxPlayers = TAXI_EXPRESS_GAME.maxPlayers;

  constructor(
    registry: GameRegistryService,
    private readonly setup: TaxiExpressSetupService,
    private readonly actions: TaxiExpressActionService,
    private readonly presenter: TaxiExpressPresenterService,
    private readonly bots: TaxiExpressBotService,
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
    return buildTaxiExpressShortcuts(ctx);
  }
}
