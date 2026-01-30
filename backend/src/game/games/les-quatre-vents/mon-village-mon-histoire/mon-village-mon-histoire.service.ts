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
import { MON_VILLAGE_GAME } from './definitions/mon-village.definition';
import { MonVillageActionService } from './actions/mon-village-action.service';
import { MonVillagePresenterService } from './presenter/mon-village-presenter.service';
import { MonVillageSetupService } from './setup/mon-village-setup.service';
import { MonVillageBotService } from './bots/mon-village-bot.service';
import * as Rulebook from './rulebook/rulebook';
import { buildMonVillageShortcuts } from './shortcuts/mon-village.shortcuts';

@Injectable()
export class MonVillageService implements GameRulesAdapter, OnModuleInit {
  readonly gameType = 'mon-village-mon-histoire';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = MON_VILLAGE_GAME.displayName;
  readonly description =
    'Parcourez les métiers et collectionnez les cartes qui feront la richesse de votre village.';
  readonly minPlayers = MON_VILLAGE_GAME.minPlayers;
  readonly maxPlayers = MON_VILLAGE_GAME.maxPlayers;

  constructor(
    private readonly registry: GameRegistryService,
    private readonly setup: MonVillageSetupService,
    private readonly actions: MonVillageActionService,
    private readonly presenter: MonVillagePresenterService,
    private readonly bots: MonVillageBotService,
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
    return buildMonVillageShortcuts(ctx);
  }
}
