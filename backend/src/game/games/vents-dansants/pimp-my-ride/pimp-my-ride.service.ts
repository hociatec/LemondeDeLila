import { Injectable, OnModuleInit } from '@nestjs/common';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../engine/dto/game-action.dto';
import type { GameRulesAdapter } from '../../../engine/interfaces/game-rules-adapter.interface';
import { GameRegistryService } from '../../../engine/services/game-registry.service';
import type {
  GameShortcutHint,
  GameShortcutsContext,
} from '../../../engine/shortcuts/game-shortcuts';
import * as Rulebook from './rulebook/rulebook';
import { PimpMyRideActionService } from './actions/pimp-my-ride-action.service';
import { PimpMyRidePresenterService } from './presenter/pimp-my-ride-presenter.service';
import { PimpMyRideSetupService } from './setup/pimp-my-ride-setup.service';
import { PimpMyRideBotService } from './bots/pimp-my-ride-bot.service';
import { PIMP_MY_RIDE_GAME } from './definitions/game.definition';
import { buildPimpMyRideShortcuts } from './pimp-my-ride.shortcuts';

@Injectable()
export class PimpMyRideService implements GameRulesAdapter, OnModuleInit {
  readonly gameType = 'pimp-my-ride';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'VentsDansants';
  readonly displayName = PIMP_MY_RIDE_GAME.displayName;
  readonly description =
    'Soyez le premier à construire trois voitures complètes en respectant l’ordre de construction classique.';
  readonly minPlayers = PIMP_MY_RIDE_GAME.minPlayers;
  readonly maxPlayers = PIMP_MY_RIDE_GAME.maxPlayers;

  constructor(
    private readonly registry: GameRegistryService,
    private readonly setup: PimpMyRideSetupService,
    private readonly actions: PimpMyRideActionService,
    private readonly presenter: PimpMyRidePresenterService,
    private readonly bots: PimpMyRideBotService,
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

  getShortcuts(ctx: GameShortcutsContext<any>): GameShortcutHint[] {
    return buildPimpMyRideShortcuts(ctx);
  }
}
