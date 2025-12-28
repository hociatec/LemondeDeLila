import { Injectable, OnModuleInit } from '@nestjs/common';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type { GameSingleActionDto, GameStateWithActions } from '../../../engine/dto/game-action.dto';
import type { GameRulesAdapter } from '../../../engine/interfaces/game-rules-adapter.interface';
import { GameRegistryService } from '../../../engine/services/game-registry.service';
import { CONTES_CACAHUETES_GAME } from './definitions/game.definition';
import { ContesCacahuetesSetupService } from './setup/contes-et-cacahuetes-setup.service';
import { ContesActionService } from './actions/contes-action.service';
import { ContesPresenterService } from './presenter/contes-presenter.service';
import { ContesBotService } from './bots/contes-bot.service';
import * as Rulebook from './rulebook/rulebook';

@Injectable()
export class ContesService implements GameRulesAdapter, OnModuleInit {
  readonly gameType = 'contes-et-cacahuetes';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = CONTES_CACAHUETES_GAME.displayName;
  readonly description = 'Course sur 60 cases avec contes, bonus, malus et surprises.';
  readonly minPlayers = CONTES_CACAHUETES_GAME.minPlayers;
  readonly maxPlayers = CONTES_CACAHUETES_GAME.maxPlayers;

  constructor(
    private readonly registry: GameRegistryService,
    private readonly setup: ContesCacahuetesSetupService,
    private readonly actions: ContesActionService,
    private readonly presenter: ContesPresenterService,
    private readonly bots: ContesBotService,
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

  validateAction(state: GameStateEntity, action: GameSingleActionDto, actorId: number | null): GameSingleActionDto {
    return Rulebook.validateAction(state, action, actorId);
  }

  getBotActions(state: GameStateEntity, botPlayerId: number): GameSingleActionDto[] {
    return this.bots.getBotActions(state, botPlayerId);
  }

  exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions {
    return this.presenter.exposeStateForUser(state, userId);
  }
}

