import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../engine/dto/game-action.dto';
import { GameRegistryService } from '../../../engine/services/game-registry.service';
import { AbstractGameService } from '../../../engine/abstract/abstract-game.service';
import type {
  GameShortcutHint,
  GameShortcutsContext,
} from '../../../engine/shortcuts/game-shortcuts';
import { PRIMALIS_GAME } from './definitions/primalis.definition';
import { PrimalisSetupService } from './setup/primalis-setup.service';
import { PrimalisActionService } from './actions/primalis-action.service';
import { PrimalisPresenterService } from './presenter/primalis-presenter.service';
import { PrimalisBotService } from './bots/primalis-bot.service';
import * as Rulebook from './rulebook/rulebook';
import { buildPrimalisShortcuts } from './shortcuts/primalis.shortcuts';

@Injectable()
export class PrimalisService extends AbstractGameService {
  readonly gameType = 'primalis';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = PRIMALIS_GAME.displayName;
  readonly description =
    'Survivez à la comète : construisez votre tribu de dinosaures et nourrissez-la avant la catastrophe finale.';
  readonly minPlayers = PRIMALIS_GAME.minPlayers;
  readonly maxPlayers = PRIMALIS_GAME.maxPlayers;

  constructor(
    registry: GameRegistryService,
    private readonly setup: PrimalisSetupService,
    private readonly actions: PrimalisActionService,
    private readonly presenter: PrimalisPresenterService,
    private readonly bots: PrimalisBotService,
  ) {
    super(registry);
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
    return buildPrimalisShortcuts(ctx);
  }
}
