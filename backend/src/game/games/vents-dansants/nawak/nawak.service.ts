import { Injectable, OnModuleInit } from '@nestjs/common';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../engine/dto/game-action.dto';
import type { GameRulesAdapter } from '../../../engine/interfaces/game-rules-adapter.interface';
import { GameRegistryService } from '../../../engine/services/game-registry.service';
import * as Rulebook from './rulebook/rulebook';
import { NawakActionService } from './actions/nawak-action.service';
import { NawakPresenterService } from './presenter/nawak-presenter.service';
import { NawakSetupService } from './setup/nawak-setup.service';
import { NAWAK_GAME } from './definitions/game.definition';

@Injectable()
export class NawakService implements GameRulesAdapter, OnModuleInit {
  readonly gameType = 'nawak';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'VentsDansants';
  readonly displayName = NAWAK_GAME.displayName;
  readonly description = 'Répondez aux défis absurdes, votez pour les réponses étrangères et cumulez les votes.';
  readonly minPlayers = NAWAK_GAME.minPlayers;
  readonly maxPlayers = NAWAK_GAME.maxPlayers;

  constructor(
    private readonly registry: GameRegistryService,
    private readonly setup: NawakSetupService,
    private readonly actions: NawakActionService,
    private readonly presenter: NawakPresenterService,
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
}
