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
import { DameNatureActionService } from './actions/dame-nature-action.service';
import { DameNaturePresenterService } from './presenter/dame-nature-presenter.service';
import { DameNatureSetupService } from './setup/dame-nature-setup.service';
import { DameNatureBotService } from './bots/dame-nature-bot.service';
import { DAME_NATURE_GAME } from './definitions/game.definition';
import { buildDameNatureShortcuts } from './dame-nature.shortcuts';

@Injectable()
export class DameNatureService implements GameRulesAdapter, OnModuleInit {
  readonly gameType = 'dame-nature';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'VentsDansants';
  readonly displayName = DAME_NATURE_GAME.displayName;
  readonly description =
    'Collectez quatre familles complètes tout en protégeant Dame Nature des pollutions.';
  readonly minPlayers = DAME_NATURE_GAME.minPlayers;
  readonly maxPlayers = DAME_NATURE_GAME.maxPlayers;

  constructor(
    private readonly registry: GameRegistryService,
    private readonly setup: DameNatureSetupService,
    private readonly actions: DameNatureActionService,
    private readonly presenter: DameNaturePresenterService,
    private readonly bots: DameNatureBotService,
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
    return buildDameNatureShortcuts(ctx);
  }
}
