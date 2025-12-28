import { Injectable, OnModuleInit } from '@nestjs/common';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type { GameSingleActionDto, GameStateWithActions } from '../../../engine/dto/game-action.dto';
import type { GameRulesAdapter } from '../../../engine/interfaces/game-rules-adapter.interface';
import { GameRegistryService } from '../../../engine/services/game-registry.service';
import { A_FOND_LES_BALLONS_GAME } from './definitions/game.definition';
import { AFondLesBallonsSetupService } from './setup/a-fond-les-ballons-setup.service';
import { AFondLesBallonsActionService } from './actions/a-fond-les-ballons-action.service';
import { AFondLesBallonsPresenterService } from './presenter/a-fond-les-ballons-presenter.service';
import { AFondLesBallonsBotService } from './bots/a-fond-les-ballons-bot.service';
import * as Rulebook from './rulebook/rulebook';

@Injectable()
export class AFondLesBallonsService implements GameRulesAdapter, OnModuleInit {
  readonly gameType = 'a-fond-les-ballons';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = A_FOND_LES_BALLONS_GAME.displayName;
  readonly description = "Course déjantée jusqu'à la Grosse Noix Dorée.";
  readonly minPlayers = A_FOND_LES_BALLONS_GAME.minPlayers;
  readonly maxPlayers = A_FOND_LES_BALLONS_GAME.maxPlayers;

  constructor(
    private readonly registry: GameRegistryService,
    private readonly setup: AFondLesBallonsSetupService,
    private readonly actions: AFondLesBallonsActionService,
    private readonly presenter: AFondLesBallonsPresenterService,
    private readonly bots: AFondLesBallonsBotService,
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

