import { Injectable, OnModuleInit } from '@nestjs/common';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../engine/dto/game-action.dto';
import type { GameRulesAdapter } from '../../../engine/interfaces/game-rules-adapter.interface';
import { GameRegistryService } from '../../../engine/services/game-registry.service';
import * as Rulebook from './rulebook/rulebook';
import { LesMainsActionService } from './actions/les-mains-de-la-terre-action.service';
import { LesMainsPresenterService } from './presenter/les-mains-de-la-terre-presenter.service';
import { LesMainsSetupService } from './setup/les-mains-de-la-terre-setup.service';
import { LES_MAINS_GAME } from './definitions/game.definition';

@Injectable()
export class LesMainsDeLaTerreService implements GameRulesAdapter, OnModuleInit {
  readonly gameType = LES_MAINS_GAME.id;
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'VentsDansants';
  readonly displayName = LES_MAINS_GAME.displayName;
  readonly description = 'Complétez des familles de métiers tout en jouant des cartes spéciales déboussolantes.';
  readonly minPlayers = LES_MAINS_GAME.minPlayers;
  readonly maxPlayers = LES_MAINS_GAME.maxPlayers;

  constructor(
    private readonly registry: GameRegistryService,
    private readonly setup: LesMainsSetupService,
    private readonly actions: LesMainsActionService,
    private readonly presenter: LesMainsPresenterService,
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

  getBotActions(_state: GameStateEntity, _botPlayerId: number): GameSingleActionDto[] {
    return [];
  }
}
