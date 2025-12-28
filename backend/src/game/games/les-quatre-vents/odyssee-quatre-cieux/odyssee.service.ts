import { Injectable, OnModuleInit } from '@nestjs/common';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type { GameSingleActionDto, GameStateWithActions } from '../../../engine/dto/game-action.dto';
import type { GameRulesAdapter } from '../../../engine/interfaces/game-rules-adapter.interface';
import { GameRegistryService } from '../../../engine/services/game-registry.service';
import { ODYSSEE_GAME } from './definitions/odyssee.definition';
import { OdysseeSetupService } from './setup/odyssee-setup.service';
import { OdysseeActionService } from './actions/odyssee-action.service';
import { OdysseePresenterService } from './presenter/odyssee-presenter.service';
import { OdysseeBotService } from './bots/odyssee-bot.service';
import * as Rulebook from './rulebook/rulebook';

@Injectable()
export class OdysseeQuatreCieuxService implements GameRulesAdapter, OnModuleInit {
  readonly gameType = 'odyssee-quatre-cieux';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = ODYSSEE_GAME.displayName;
  readonly description = 'Course galactique (type petits chevaux).';
  readonly minPlayers = ODYSSEE_GAME.minPlayers;
  readonly maxPlayers = ODYSSEE_GAME.maxPlayers;

  constructor(
    private readonly registry: GameRegistryService,
    private readonly setup: OdysseeSetupService,
    private readonly actions: OdysseeActionService,
    private readonly presenter: OdysseePresenterService,
    private readonly bots: OdysseeBotService,
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
