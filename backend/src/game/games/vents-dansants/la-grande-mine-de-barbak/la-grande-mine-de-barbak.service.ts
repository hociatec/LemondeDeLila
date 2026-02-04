import { Injectable, OnModuleInit } from '@nestjs/common';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../engine/dto/game-action.dto';
import type { GameRulesAdapter } from '../../../engine/interfaces/game-rules-adapter.interface';
import { GameRegistryService } from '../../../engine/services/game-registry.service';
import * as Rulebook from './rulebook/rulebook';
import { LaGrandeMineDeBarbakActionService } from './actions/la-grande-mine-de-barbak-action.service';
import { LaGrandeMineDeBarbakPresenterService } from './presenter/la-grande-mine-de-barbak-presenter.service';
import { LaGrandeMineSetupService } from './setup/la-grande-mine-de-barbak-setup.service';
import { LaGrandeMineDeBarbakBotService } from './bots/la-grande-mine-de-barbak-bot.service';
import { LA_GRANDE_MINE_GAME } from './definitions/game.definition';

@Injectable()
export class LaGrandeMineDeBarbakService implements GameRulesAdapter, OnModuleInit {
  readonly gameType = 'la-grande-mine-de-barbak';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'VentsDansants';
  readonly displayName = LA_GRANDE_MINE_GAME.displayName;
  readonly description =
    'Explorez la mine, posez vos trésors et affrontez vos adversaires pour devenir le Nain suprême.';
  readonly minPlayers = LA_GRANDE_MINE_GAME.minPlayers;
  readonly maxPlayers = LA_GRANDE_MINE_GAME.maxPlayers;

  constructor(
    private readonly registry: GameRegistryService,
    private readonly setup: LaGrandeMineSetupService,
    private readonly actions: LaGrandeMineDeBarbakActionService,
    private readonly presenter: LaGrandeMineDeBarbakPresenterService,
    private readonly bots: LaGrandeMineDeBarbakBotService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
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

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    return this.presenter.exposeStateForUser(state, userId);
  }

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    return this.bots.getBotActions(state, botPlayerId);
  }
}
