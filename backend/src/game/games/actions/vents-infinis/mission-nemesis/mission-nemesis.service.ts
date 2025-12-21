import { Injectable, OnModuleInit } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../../engine/dto/game-action.dto';
import type { GameRulesAdapter } from '../../../../engine/interfaces/game-rules-adapter.interface';
import { GameRegistryService } from '../../../../engine/services/game-registry.service';
import * as MissionNemesisRulebook from './rulebook/rulebook';
import { MissionNemesisActionService } from './actions/mission-nemesis-action.service';
import { MissionNemesisPhaseService } from './phases/mission-nemesis-phase.service';
import { MissionNemesisPresenterService } from './presenter/mission-nemesis-presenter.service';
import { MissionNemesisSetupService } from './setup/mission-nemesis-setup.service';

@Injectable()
export class MissionNemesisService implements GameRulesAdapter, OnModuleInit {
  readonly gameType = 'mission-nemesis';
  readonly category = 'Actions';
  readonly subcategory = 'VentsInfinis';
  readonly displayName = 'Mission Nemesis';
  readonly description = 'Prototype (WIP).';
  readonly minPlayers = 2;
  readonly maxPlayers = 6;

  constructor(
    private readonly registry: GameRegistryService,
    private readonly setup: MissionNemesisSetupService,
    private readonly actions: MissionNemesisActionService,
    private readonly phases: MissionNemesisPhaseService,
    private readonly presenter: MissionNemesisPresenterService,
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
    return MissionNemesisRulebook.getAvailableActions(state, playerId);
  }

  validateAction(
    state: GameStateEntity,
    action: GameSingleActionDto,
    _actorId: number | null,
  ): GameSingleActionDto {
    return MissionNemesisRulebook.validateAction(state, action);
  }

  exposeState(state: GameStateEntity): GameStateWithActions {
    return this.presenter.exposeState(state);
  }
}
