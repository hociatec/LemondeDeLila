import { Injectable, OnModuleInit } from '@nestjs/common';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../engine/dto/game-action.dto';
import type { GameRulesAdapter } from '../../../engine/interfaces/game-rules-adapter.interface';
import { GameRegistryService } from '../../../engine/services/game-registry.service';
import * as Rulebook from './rulebook/rulebook';
import { LaParadeSucreeActionService } from './actions/la-parade-sucree-action.service';
import { LaParadeSucreePresenterService } from './presenter/la-parade-sucree-presenter.service';
import { LaParadeSucreeSetupService } from './setup/la-parade-sucree-setup.service';
import { LaParadeSucreeBotService } from './bots/la-parade-sucree-bot.service';
import { LA_PARADE_SUCREE_GAME } from './definitions/game.definition';

@Injectable()
export class LaParadeSucreeService implements GameRulesAdapter, OnModuleInit {
  readonly gameType = 'la-parade-sucree';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'VentsDansants';
  readonly displayName = LA_PARADE_SUCREE_GAME.displayName;
  readonly description =
    'Posez les cartes dans l’ordre et collectionnez les friandises des cases spéciales.';
  readonly minPlayers = LA_PARADE_SUCREE_GAME.minPlayers;
  readonly maxPlayers = LA_PARADE_SUCREE_GAME.maxPlayers;

  constructor(
    private readonly registry: GameRegistryService,
    private readonly setup: LaParadeSucreeSetupService,
    private readonly actions: LaParadeSucreeActionService,
    private readonly presenter: LaParadeSucreePresenterService,
    private readonly bots: LaParadeSucreeBotService,
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
    return this.bots.getBotActions();
  }
}
