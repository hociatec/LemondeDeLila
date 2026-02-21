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
import { VOYAGE_GAME } from './definitions/voyage.definition';
import { VoyageSetupService } from './setup/voyage-setup.service';
import { VoyageActionService } from './actions/voyage-action.service';
import { VoyagePresenterService } from './presenter/voyage-presenter.service';
import { VoyageBotService } from './bots/voyage-bot.service';
import * as Rulebook from './rulebook/rulebook';
import { buildVoyageShortcuts } from './voyage.shortcuts';

@Injectable()
export class VoyageService extends AbstractGameService {
  readonly gameType = 'voyage-en-terre-de-brumes';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = VOYAGE_GAME.displayName;
  readonly description =
    'Voyage en Irlande : quiz de légendes, farces et trésors.';
  readonly minPlayers = VOYAGE_GAME.minPlayers;
  readonly maxPlayers = VOYAGE_GAME.maxPlayers;

  constructor(
    registry: GameRegistryService,
    private readonly setup: VoyageSetupService,
    private readonly actions: VoyageActionService,
    private readonly presenter: VoyagePresenterService,
    private readonly bots: VoyageBotService,
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
    return buildVoyageShortcuts(ctx);
  }
}
