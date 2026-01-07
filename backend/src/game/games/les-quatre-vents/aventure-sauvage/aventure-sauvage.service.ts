import { Injectable, OnModuleInit } from '@nestjs/common';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../engine/dto/game-action.dto';
import type { GameRulesAdapter } from '../../../engine/interfaces/game-rules-adapter.interface';
import { GameRegistryService } from '../../../engine/services/game-registry.service';
import { AVENTURE_SAUVAGE_GAME } from './definitions/game.definition';
import { AventureSauvageSetupService } from './setup/aventure-sauvage-setup.service';
import { AventureSauvageActionService } from './actions/aventure-sauvage-action.service';
import { AventureSauvagePresenterService } from './presenter/aventure-sauvage-presenter.service';
import { AventureSauvageBotService } from './bots/aventure-sauvage-bot.service';
import * as Rulebook from './rulebook/rulebook';

@Injectable()
export class AventureSauvageService implements GameRulesAdapter, OnModuleInit {
  readonly gameType = 'aventure-sauvage';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = AVENTURE_SAUVAGE_GAME.displayName;
  readonly description = "Course en jungle jusqu'à la mare.";
  readonly minPlayers = AVENTURE_SAUVAGE_GAME.minPlayers;
  readonly maxPlayers = AVENTURE_SAUVAGE_GAME.maxPlayers;

  constructor(
    private readonly registry: GameRegistryService,
    private readonly setup: AventureSauvageSetupService,
    private readonly actions: AventureSauvageActionService,
    private readonly presenter: AventureSauvagePresenterService,
    private readonly bots: AventureSauvageBotService,
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
}
