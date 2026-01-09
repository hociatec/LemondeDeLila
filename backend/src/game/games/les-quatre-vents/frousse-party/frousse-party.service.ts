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
import { FROUSSE_GAME } from './definitions/frousse.definition';
import { FrousseSetupService } from './setup/frousse-setup.service';
import { FrousseActionService } from './actions/frousse-action.service';
import { FroussePresenterService } from './presenter/frousse-presenter.service';
import { FrousseBotService } from './bots/frousse-bot.service';
import * as Rulebook from './rulebook/rulebook';
import { buildFrousseShortcuts } from './frousse.shortcuts';

@Injectable()
export class FroussePartyService implements GameRulesAdapter, OnModuleInit {
  readonly gameType = 'frousse-party';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = FROUSSE_GAME.displayName;
  readonly description = 'Course dans un manoir avec cartes surprises.';
  readonly minPlayers = FROUSSE_GAME.minPlayers;
  readonly maxPlayers = FROUSSE_GAME.maxPlayers;

  constructor(
    private readonly registry: GameRegistryService,
    private readonly setup: FrousseSetupService,
    private readonly actions: FrousseActionService,
    private readonly presenter: FroussePresenterService,
    private readonly bots: FrousseBotService,
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
    return buildFrousseShortcuts(ctx);
  }
}
