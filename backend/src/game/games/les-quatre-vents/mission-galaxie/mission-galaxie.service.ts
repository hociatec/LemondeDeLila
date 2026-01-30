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
import { MISSION_GALAXIE_GAME } from './definitions/mission-galaxie.definition';
import { MissionGalaxieSetupService } from './setup/mission-galaxie-setup.service';
import { MissionGalaxieActionService } from './actions/mission-galaxie-action.service';
import { MissionGalaxiePresenterService } from './presenter/mission-galaxie-presenter.service';
import { MissionGalaxieBotService } from './bots/mission-galaxie-bot.service';
import * as Rulebook from './rulebook/rulebook';
import { buildMissionGalaxieShortcuts } from './shortcuts/mission-galaxie.shortcuts';

@Injectable()
export class MissionGalaxieService implements GameRulesAdapter, OnModuleInit {
  readonly gameType = 'mission-galaxie';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = MISSION_GALAXIE_GAME.displayName;
  readonly description =
    'Course cosmique autour de 50 cases : questions, défis et événements vous propulsent vers la planète légendaire.';
  readonly minPlayers = MISSION_GALAXIE_GAME.minPlayers;
  readonly maxPlayers = MISSION_GALAXIE_GAME.maxPlayers;

  constructor(
    private readonly registry: GameRegistryService,
    private readonly setup: MissionGalaxieSetupService,
    private readonly actions: MissionGalaxieActionService,
    private readonly presenter: MissionGalaxiePresenterService,
    private readonly bots: MissionGalaxieBotService,
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

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    return this.bots.getBotActions(state, botPlayerId);
  }

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    return this.presenter.exposeStateForUser(state, userId);
  }

  getShortcuts(ctx: GameShortcutsContext<any>): GameShortcutHint[] {
    return buildMissionGalaxieShortcuts(ctx);
  }
}
