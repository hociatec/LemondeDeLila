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
import { CA_DERAPE_GAME } from './definitions/ca.definition';
import { CaSetupService } from './setup/ca.setup';
import { CaActionService } from './actions/ca-actions.service';
import { CaPresenterService } from './presenter/ca-presenter.service';
import { CaBotService } from './bots/ca-bot.service';
import * as Rulebook from './rulebook/ca.rulebook';
import { buildCaDerapeShortcuts } from './ca-derape.shortcuts';

@Injectable()
export class CaDerapeService extends AbstractGameService {
  readonly gameType = 'ca-derape';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = CA_DERAPE_GAME.displayName;
  readonly description = 'Course chaotique sur 30 cases avec cartes Situation.';
  readonly minPlayers = CA_DERAPE_GAME.minPlayers;
  readonly maxPlayers = CA_DERAPE_GAME.maxPlayers;

  constructor(
    registry: GameRegistryService,
    private readonly setup: CaSetupService,
    private readonly actions: CaActionService,
    private readonly presenter: CaPresenterService,
    private readonly bots: CaBotService,
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
    return buildCaDerapeShortcuts(ctx);
  }
}
