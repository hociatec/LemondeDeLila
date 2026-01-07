import { Injectable, OnModuleInit } from '@nestjs/common';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../engine/dto/game-action.dto';
import type { GameRulesAdapter } from '../../../engine/interfaces/game-rules-adapter.interface';
import { GameRegistryService } from '../../../engine/services/game-registry.service';
import * as PetitChevauxRulebook from './rulebook/rulebook';
import { PetitChevauxActionService } from './actions/petit-chevaux-action.service';
import { PetitChevauxPhaseService } from './phases/petit-chevaux-phase.service';
import { PetitChevauxPresenterService } from './presenter/petit-chevaux-presenter.service';
import { PetitChevauxSetupService } from './setup/petit-chevaux-setup.service';
import { PETIT_CHEVAUX_GAME } from './definitions/game.definition';
import { PetitChevauxBotService } from './bots/petit-chevaux-bot.service';

@Injectable()
export class PetitChevauxService implements GameRulesAdapter, OnModuleInit {
  readonly gameType = 'petit-chevaux';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'Galopant';
  readonly displayName = PETIT_CHEVAUX_GAME.displayName;
  readonly description = 'le jeu classique des petits chevaux';
  readonly minPlayers = PETIT_CHEVAUX_GAME.minPlayers;
  readonly maxPlayers = PETIT_CHEVAUX_GAME.maxPlayers;

  constructor(
    private readonly registry: GameRegistryService,
    private readonly setup: PetitChevauxSetupService,
    private readonly actions: PetitChevauxActionService,
    private readonly phases: PetitChevauxPhaseService,
    private readonly presenter: PetitChevauxPresenterService,
    private readonly bots: PetitChevauxBotService,
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
    const next = this.actions.applyActions(state, actions);
    return this.phases.advance(next);
  }

  getAvailableActions(
    state: GameStateEntity,
    playerId: number,
  ): GameSingleActionDto[] {
    return PetitChevauxRulebook.getAvailableActions(state, playerId);
  }

  validateAction(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameSingleActionDto {
    return PetitChevauxRulebook.validateAction(state, action, actorId);
  }

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    return this.bots.getBotActions(state, botPlayerId);
  }

  exposeState(state: GameStateEntity): GameStateWithActions {
    // Fallback (non personnalisé) : aucune action.
    return { ...state, actions: [] };
  }

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    return this.presenter.exposeStateForUser(state, userId);
  }
}
