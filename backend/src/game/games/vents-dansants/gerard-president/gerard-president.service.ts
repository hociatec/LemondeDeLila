import { Injectable, OnModuleInit } from '@nestjs/common';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../engine/dto/game-action.dto';
import type { GameRulesAdapter } from '../../../engine/interfaces/game-rules-adapter.interface';
import { GameRegistryService } from '../../../engine/services/game-registry.service';
import * as Rulebook from './rulebook/rulebook';
import { GerardPresidentActionService } from './actions/gerard-president-action.service';
import { GerardPresidentBotService } from './bots/gerard-president-bot.service';
import { GerardPresidentPresenterService } from './presenter/gerard-president-presenter.service';
import { GerardPresidentSetupService } from './setup/gerard-president-setup.service';
import { GERARD_PRESIDENT_GAME } from './definitions/game.definition';

@Injectable()
export class GerardPresidentService implements GameRulesAdapter, OnModuleInit {
  readonly gameType = 'gerard-president';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'VentsDansants';
  readonly displayName = GERARD_PRESIDENT_GAME.displayName;
  readonly description = 'Un jeu d’humour où le prénom le plus absurde remporte les manches.';
  readonly minPlayers = GERARD_PRESIDENT_GAME.minPlayers;
  readonly maxPlayers = GERARD_PRESIDENT_GAME.maxPlayers;

  constructor(
    private readonly registry: GameRegistryService,
    private readonly setup: GerardPresidentSetupService,
    private readonly actions: GerardPresidentActionService,
    private readonly presenter: GerardPresidentPresenterService,
    private readonly bots: GerardPresidentBotService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    return this.setup.hydrateInitialState(baseState);
  }

  applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity {
    return this.actions.applyActions(state, actions);
  }

  getAvailableActions(state: GameStateEntity, playerId: number): GameSingleActionDto[] {
    return Rulebook.getAvailableActions(state, playerId);
  }

  validateAction(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameSingleActionDto {
    return Rulebook.validateAction(state, action, actorId);
  }

  exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions {
    return this.presenter.exposeStateForUser(state, userId);
  }

  getBotActions(state: GameStateEntity, botPlayerId: number): GameSingleActionDto[] {
    return this.bots.getBotActions();
  }
}
